/**
 * ChatbotAgent - LangChain ReAct agent với tool-calling thật.
 *
 * LangChain v1.x đã đổi API: `createToolCallingAgent` + `AgentExecutor`
 * được thay bằng `createAgent` (ReAct + middleware).
 *
 * Bật qua env: CHATBOT_USE_AGENT=true
 *
 * Flow:
 * 1. LLM nhận message + history + tools → quyết định gọi tool hoặc trả lời
 * 2. Nếu gọi tool → thực thi → trả kết quả cho LLM
 * 3. LLM sinh câu trả lời cuối (có thể stream)
 * 4. Lưu message vào history
 */

const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require('@langchain/core/prompts');
const {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} = require('@langchain/core/messages');
const { DynamicTool } = require('@langchain/core/tools');
const { createAgent } = require('langchain');

const { toolHandlers } = require('./chatbot.tools');
const { toolDefinitions, SYSTEM_PROMPT } = require('../configs/chatbot.config');
const logger = require('./logger');
const metrics = require('../monitoring/chatbot.metrics');

const MAX_ITERATIONS = Number(process.env.CHATBOT_AGENT_MAX_ITERATIONS) || 4;
const MAX_OUTPUT_CHARS = Number(process.env.CHATBOT_AGENT_MAX_TOOL_OUTPUT) || 4000;

const buildTools = () =>
  toolDefinitions.map((td) => {
    const def = td.function || td;
    return new DynamicTool({
      name: def.name,
      description: def.description || def.name,
      func: async (input) => {
        const t0 = Date.now();
        let args = {};
        try {
          args = typeof input === 'string' ? JSON.parse(input) : input || {};
        } catch (_e) {
          logger.warn(`[Agent] tool ${def.name} bad JSON args`, { input });
          return JSON.stringify({ error: 'Invalid JSON arguments' });
        }
        const handler = toolHandlers[def.name];
        if (!handler) {
          metrics.chatbotErrorsTotal.inc({ stage: `tool_missing:${def.name}` });
          return JSON.stringify({ error: `Tool ${def.name} not found` });
        }
        try {
          const result = await handler(args);
          metrics.chatbotTokensTotal.inc(
            { direction: 'in' },
            metrics.estimateTokens(JSON.stringify(result)),
          );
          const truncated = JSON.stringify(result).slice(0, MAX_OUTPUT_CHARS);
          logger.debug('[Agent] tool ok', {
            tool: def.name,
            durationMs: Date.now() - t0,
            resultLen: truncated.length,
          });
          return truncated;
        } catch (err) {
          logger.error(`[Agent] tool ${def.name} error:`, err.message);
          metrics.chatbotErrorsTotal.inc({ stage: `tool_error:${def.name}` });
          return JSON.stringify({ error: err.message });
        }
      },
    });
  });

class ChatbotAgent {
  constructor(model, _getMessageHistory) {
    this.model = model;
    this.tools = buildTools();

    this.prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    // LangChain v1.x: createAgent thay thế createToolCallingAgent + AgentExecutor
    this.agent = createAgent({
      llm: this.model,
      tools: this.tools,
      prompt: this.prompt,
    });
  }

  /**
   * Non-streaming agent call
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<{success:boolean, message:string, sessionId:string, toolCalls?:Array}>}
   */
  async invoke(sessionId, userMessage) {
    const stopTimer = metrics.chatbotLatencySeconds.startTimer({
      endpoint: 'agent',
      stream: 'false',
    });
    try {
      metrics.chatbotTokensTotal.inc(
        { direction: 'in' },
        metrics.estimateTokens(userMessage),
      );

      // createAgent v1.x: truyền messages array
      const result = await this.agent.invoke({
        messages: [{ role: 'user', content: userMessage }],
      });

      // Extract final AI message
      const messages = result?.messages || [];
      const lastAi = [...messages].reverse().find((m) => m?.type === 'ai' || m?._getType?.() === 'ai');
      const output = (lastAi?.content || '').toString().trim();

      // Track tool calls từ messages
      const toolCalls = messages
        .filter((m) => m?.tool_calls?.length)
        .flatMap((m) => m.tool_calls.map((tc) => tc.name || tc.function?.name).filter(Boolean));

      if (toolCalls.length > 0) {
        metrics.chatbotRequestsTotal.inc({ endpoint: 'agent_tool', status: 'success' });
      }

      metrics.chatbotTokensTotal.inc(
        { direction: 'out' },
        metrics.estimateTokens(output),
      );
      stopTimer({ status: 'success' });
      return {
        success: true,
        message: output,
        sessionId,
        toolCalls,
      };
    } catch (err) {
      logger.error('[Agent] invoke error:', err.message);
      metrics.chatbotErrorsTotal.inc({ stage: 'agent' });
      stopTimer({ status: 'error' });
      return {
        success: false,
        message: 'Xin lỗi, hệ thống đang bận. Anh/chị vui lòng thử lại sau nhé!',
        error: err.message,
        sessionId,
        toolCalls: [],
      };
    }
  }

  /**
   * Streaming agent: yield { type, content } events.
   *
   * Dùng bindTools + loop thủ công để có control tốt hơn cho SSE.
   */
  async *stream(sessionId, userMessage) {
    metrics.chatbotTokensTotal.inc(
      { direction: 'in' },
      metrics.estimateTokens(userMessage),
    );

    const messages = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userMessage)];

    let iteration = 0;
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      const response = await this.model.bindTools(this.tools).invoke(messages);
      const toolCalls = response.tool_calls || [];

      if (toolCalls.length === 0) {
        // Final answer — yield từng word cho UX mượt
        const content = response.content || '';
        for (const word of String(content).split(/(\s+)/)) {
          if (word) yield { type: 'token', content: word };
        }
        metrics.chatbotTokensTotal.inc(
          { direction: 'out' },
          metrics.estimateTokens(content),
        );
        return;
      }

      // Có tool call → thêm AI message + execute tools
      messages.push(response);
      for (const call of toolCalls) {
        yield { type: 'tool_call', name: call.name, args: call.args };
        const tool = this.tools.find((t) => t.name === call.name);
        let result;
        try {
          result = await tool.func(JSON.stringify(call.args));
        } catch (e) {
          result = JSON.stringify({ error: e.message });
          metrics.chatbotErrorsTotal.inc({ stage: `tool_error:${call.name}` });
        }
        yield { type: 'tool_result', name: call.name };
        messages.push(
          new ToolMessage({
            content: typeof result === 'string' ? result : JSON.stringify(result),
            tool_call_id: call.id,
          }),
        );
      }
    }

    // Vượt max iterations → fallback
    yield {
      type: 'token',
      content: 'Xin lỗi, em chưa thể xử lý yêu cầu phức tạp này. Anh/chị vui lòng thử lại nhé!',
    };
  }
}

module.exports = ChatbotAgent;
