/**
 * ChatbotAgent - Agent tool-calling thật (bindTools + loop thủ công).
 *
 * Bật qua env: CHATBOT_USE_AGENT=true
 *
 * Flow:
 * 1. Load history từ MongoDB (getMessages đã được wrap truncate theo token budget)
 *    làm context multi-turn
 * 2. LLM nhận [system, ...history, human] + tools → quyết định gọi tool hoặc trả lời
 * 3. Nếu gọi tool → thực thi → trả kết quả ToolMessage cho LLM
 * 4. LLM sinh câu trả lời cuối (stream từng word)
 * 5. Persist human + assistant message vào history để lượt chat sau có context
 *    (và messageId trong event 'done' khớp tin nhắn thật cho feature feedback)
 */

const {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} = require('@langchain/core/messages');
const { DynamicTool } = require('@langchain/core/tools');

const { toolHandlers } = require('./chatbot.tools');
const { toolDefinitions, SYSTEM_PROMPT } = require('../configs/chatbot.config');
const logger = require('../utils/logger');
const metrics = require('../monitoring/chatbot.metrics');

const MAX_ITERATIONS = Number(process.env.CHATBOT_AGENT_MAX_ITERATIONS) || 4;
const MAX_OUTPUT_CHARS = Number(process.env.CHATBOT_AGENT_MAX_TOOL_OUTPUT) || 4000;
const MAX_ITERATIONS_FALLBACK =
  'Xin lỗi, em chưa thể xử lý yêu cầu phức tạp này. Anh/chị vui lòng thử lại nhé!';

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
  /**
   * @param {Object} model - Chat model (ChatMistralAI)
   * @param {(sessionId: string) => Object} getMessageHistory - callback trả về
   *        MongoDBChatMessageHistory cho sessionId (getMessages đã truncate
   *        theo token budget, addMessage persist thẳng vào DB)
   */
  constructor(model, getMessageHistory) {
    this.model = model;
    this.tools = buildTools();
    this.getMessageHistory = getMessageHistory;
  }

  /**
   * Build context đầu vào cho LLM: system prompt + history + user message.
   * History từ getMessages() là plain object {role, content} (đã qua
   * truncateHistory) → convert lại BaseMessage cho ChatMistralAI.
   * @returns {Promise<{history: Object, messages: Array}>}
   */
  async _buildContext(sessionId, userMessage) {
    const history = this.getMessageHistory(sessionId);
    const rawHistory = await history.getMessages();

    const historyMessages = (rawHistory || []).map((m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      const role = m.role || m.type;
      return role === 'ai' || role === 'assistant'
        ? new AIMessage(content)
        : new HumanMessage(content);
    });

    return {
      history,
      messages: [
        new SystemMessage(SYSTEM_PROMPT),
        ...historyMessages,
        new HumanMessage(userMessage),
      ],
    };
  }

  /**
   * Persist lượt chat (user + assistant) vào history.
   * Lỗi lưu history KHÔNG được làm gãy phản hồi đã stream cho user —
   * chỉ log + tăng metrics.
   */
  async _saveTurnToHistory(history, userMessage, assistantContent) {
    try {
      await history.addMessage(new HumanMessage(userMessage));
      await history.addMessage(new AIMessage(assistantContent));
    } catch (err) {
      logger.error('[Agent] Failed to persist messages to history:', err.message);
      metrics.chatbotErrorsTotal.inc({ stage: 'agent_history_save' });
    }
  }

  /**
   * Thực thi tool calls của 1 lượt LLM, push ToolMessage vào messages.
   * Yield event tool_call/tool_result để phía SSE hiển thị tiến trình.
   * @param {Array} messages - Message list đang build (mutate in-place)
   * @param {Array} calls - Tool calls từ response của LLM
   */
  async *_runToolCalls(messages, calls) {
    for (const call of calls) {
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

      const { history, messages } = await this._buildContext(sessionId, userMessage);

      let output = '';
      const toolCalls = [];

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const response = await this.model.bindTools(this.tools).invoke(messages);
        const calls = response.tool_calls || [];

        if (calls.length === 0) {
          output = String(response.content || '').trim();
          break;
        }

        messages.push(response);
        for await (const event of this._runToolCalls(messages, calls)) {
          if (event.type === 'tool_call') toolCalls.push(event.name);
        }
      }

      // Vượt max iterations mà chưa có final answer → fallback
      if (!output) {
        output = MAX_ITERATIONS_FALLBACK;
      }

      await this._saveTurnToHistory(history, userMessage, output);

      metrics.chatbotTokensTotal.inc(
        { direction: 'out' },
        metrics.estimateTokens(output),
      );
      stopTimer({ status: 'success' });

      return {
        success: true,
        message: output,
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
   * Cuối stream persist lượt chat vào history (nhờ đó câu hỏi follow-up
   * như "cái đầu tiên bao nhiêu tiền?" có context, và messageId trả về
   * trong event 'done' khớp với tin nhắn thật trong DB).
   */
  async *stream(sessionId, userMessage) {
    metrics.chatbotTokensTotal.inc(
      { direction: 'in' },
      metrics.estimateTokens(userMessage),
    );

    const { history, messages } = await this._buildContext(sessionId, userMessage);

    let finalContent = '';

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await this.model.bindTools(this.tools).invoke(messages);
      const toolCalls = response.tool_calls || [];

      if (toolCalls.length === 0) {
        // Final answer — yield từng word cho UX mượt
        finalContent = String(response.content || '');
        for (const word of finalContent.split(/(\s+)/)) {
          if (word) yield { type: 'token', content: word };
        }
        break;
      }

      // Có tool call → thêm AI message + execute tools
      messages.push(response);
      yield* this._runToolCalls(messages, toolCalls);
    }

    // Vượt max iterations → fallback
    if (!finalContent) {
      finalContent = MAX_ITERATIONS_FALLBACK;
      yield { type: 'token', content: finalContent };
    }

    metrics.chatbotTokensTotal.inc(
      { direction: 'out' },
      metrics.estimateTokens(finalContent),
    );

    await this._saveTurnToHistory(history, userMessage, finalContent);
  }
}

module.exports = ChatbotAgent;

