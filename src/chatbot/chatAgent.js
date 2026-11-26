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

const { AIMessage, HumanMessage, SystemMessage, ToolMessage } = require('@langchain/core/messages');

const { toolHandlers } = require('./chatbot.tools');
const { toolDefinitions, SYSTEM_PROMPT } = require('../configs/chatbot.config');
const {
  escapePromptText,
  validateResponse,
  collectGroundedAmounts,
} = require('./chatbotHelpers');
const logger = require('../utils/logger');
const metrics = require('../monitoring/chatbot.metrics');

const MAX_ITERATIONS = Number(process.env.CHATBOT_AGENT_MAX_ITERATIONS) || 4;
const MAX_OUTPUT_CHARS = Number(process.env.CHATBOT_AGENT_MAX_TOOL_OUTPUT) || 4000;
const MAX_ITERATIONS_FALLBACK =
  'Xin lỗi, em chưa thể xử lý yêu cầu phức tạp này. Anh/chị vui lòng thử lại nhé!';

// Tool trả về mức tiền hợp lệ (không phải sản phẩm): policy, freeship, voucher.
const GROUNDING_AMOUNT_TOOL_NAMES = new Set([
  'search_store_policies',
  'get_available_vouchers',
]);

const PRODUCT_TOOL_NAMES = new Set([
  'search_products',
  'search_products_advanced',
  'search_products_by_brand',
  'search_products_by_price_range',
  'semantic_search_products',
  'get_discounted_products',
  'get_bestseller_products',
  'get_new_arrival_products',
  'get_related_products',
  'get_featured_products',
  'compare_products',
]);

// Tool trả về 1 object sản phẩm/biến thể/link mua đơn lẻ (không phải mảng).
const SINGLE_PRODUCT_TOOL_NAMES = new Set([
  'get_product_details',
  'check_product_availability',
  'generate_checkout_link',
]);

const normalizeToolArgs = (rawArgs) => {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'string') {
    return JSON.parse(rawArgs);
  }
  return rawArgs;
};

const serializeToolResultForLLM = (result) => {
  const full = JSON.stringify(result);
  if (full.length <= MAX_OUTPUT_CHARS) return full;

  if (Array.isArray(result)) {
    const kept = [];
    let size = 2;
    for (const item of result) {
      const compact =
        item && typeof item === 'object' && typeof item.description === 'string'
          ? { ...item, description: item.description.slice(0, 160) }
          : item;
      const serialized = JSON.stringify(compact);
      if (size + serialized.length + 1 > MAX_OUTPUT_CHARS) break;
      kept.push(compact);
      size += serialized.length + 1;
    }
    return JSON.stringify(kept);
  }

  if (result && typeof result === 'object') {
    const compact = { ...result };
    if (typeof compact.description === 'string') {
      compact.description = compact.description.slice(0, 200);
    }
    if (compact.product && typeof compact.product.description === 'string') {
      compact.product = {
        ...compact.product,
        description: compact.product.description.slice(0, 200),
      };
    }
    const compactJson = JSON.stringify(compact);
    if (compactJson.length <= MAX_OUTPUT_CHARS) return compactJson;
  }

  return full.slice(0, MAX_OUTPUT_CHARS);
};

const executeToolHandler = async (name, rawArgs) => {
  const t0 = Date.now();
  let args = {};
  try {
    args = normalizeToolArgs(rawArgs);
  } catch (_e) {
    logger.warn(`[Agent] tool ${name} bad JSON args`, { rawArgs });
    return {
      rawResult: null,
      content: JSON.stringify({ error: 'Invalid JSON arguments' }),
    };
  }

  const handler = toolHandlers[name];
  if (!handler) {
    metrics.chatbotErrorsTotal.inc({ stage: `tool_missing:${name}` });
    return {
      rawResult: null,
      content: JSON.stringify({ error: `Tool ${name} not found` }),
    };
  }

  try {
    const result = await handler(args);
    const fullStr = JSON.stringify(result);
    metrics.chatbotTokensTotal.inc({ direction: 'in' }, metrics.estimateTokens(fullStr));
    const content = serializeToolResultForLLM(result);
    logger.debug('[Agent] tool ok', {
      tool: name,
      durationMs: Date.now() - t0,
      resultLen: content.length,
    });
    return { rawResult: result, content };
  } catch (err) {
    logger.error(`[Agent] tool ${name} error:`, err.message);
    metrics.chatbotErrorsTotal.inc({ stage: `tool_error:${name}` });
    return {
      rawResult: null,
      content: JSON.stringify({ error: err.message }),
    };
  }
};

class ChatbotAgent {
  /**
   * @param {Object} model - Chat model (ChatMistralAI)
   * @param {(sessionId: string) => Object} getMessageHistory - callback trả về
   *        MongoDBChatMessageHistory cho sessionId (getMessages đã truncate
   *        theo token budget, addMessage persist thẳng vào DB)
   */
  constructor(model, getMessageHistory) {
    this.model = model;
    // Bind OpenAI-format tool definitions directly so Mistral receives full JSON Schemas.
    this.tools = toolDefinitions;
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
        new HumanMessage(escapePromptText(userMessage)),
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
   * Đồng thời thu thập các products từ raw tool results (trước khi truncate) để dùng cho grounding check.
   * @param {Array} messages - Message list đang build (mutate in-place)
   * @param {Array} calls - Tool calls từ response của LLM
   * @param {Array} [collectedProducts=[]] - Mảng tích lũy sản phẩm để validate
   * @param {Array} [collectedAmounts=[]] - Mức tiền hợp lệ từ tool policy/voucher
   */
  async *_runToolCalls(messages, calls, collectedProducts = [], collectedAmounts = []) {
    for (const call of calls) {
      yield { type: 'tool_call', name: call.name, args: call.args };

      const { rawResult, content } = await executeToolHandler(call.name, call.args);

      if (PRODUCT_TOOL_NAMES.has(call.name) && Array.isArray(rawResult)) {
        const products = rawResult.filter((item) => item && item.id && item.name);
        collectedProducts.push(...products);
        if (products.length > 0) {
          yield { type: 'products', products };
        }
      } else if (
        SINGLE_PRODUCT_TOOL_NAMES.has(call.name) &&
        rawResult &&
        typeof rawResult === 'object' &&
        !Array.isArray(rawResult) &&
        !rawResult.error
      ) {
        collectedProducts.push(rawResult);
      }

      if (GROUNDING_AMOUNT_TOOL_NAMES.has(call.name) && rawResult) {
        collectedAmounts.push(...collectGroundedAmounts(rawResult));
      }

      yield { type: 'tool_result', name: call.name };
      messages.push(
        new ToolMessage({
          content,
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
      metrics.chatbotTokensTotal.inc({ direction: 'in' }, metrics.estimateTokens(userMessage));

      const { history, messages } = await this._buildContext(sessionId, userMessage);

      let output = '';
      const toolCalls = [];
      const collectedProducts = [];
      const collectedAmounts = [];

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const response = await this.model.bindTools(this.tools).invoke(messages);
        const calls = response.tool_calls || [];

        if (calls.length === 0) {
          output = String(response.content || '').trim();
          break;
        }

        messages.push(response);
        for await (const event of this._runToolCalls(
          messages,
          calls,
          collectedProducts,
          collectedAmounts,
        )) {
          if (event.type === 'tool_call') toolCalls.push(event.name);
        }
      }

      // Vượt max iterations mà chưa có final answer → fallback
      if (!output) {
        output = MAX_ITERATIONS_FALLBACK;
      }

      // Grounding validation cho agent mode
      const validated = validateResponse(output, collectedProducts, logger, {
        allowedAmounts: collectedAmounts,
      });
      if (validated !== output) {
        metrics.chatbotHallucinationTotal.inc({ kind: 'replaced_agent' });
        output = validated;
      }

      await this._saveTurnToHistory(history, userMessage, output);

      metrics.chatbotTokensTotal.inc({ direction: 'out' }, metrics.estimateTokens(output));
      stopTimer({ status: 'success' });

      return {
        success: true,
        message: output,
        toolCalls,
        products: collectedProducts,
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
   * - Intermediate iterations (tool-calling): dùng invoke() để detect tool_calls
   * - Final answer (no tool calls): stream tokens mượt mà cho client
   * - Grounding check: phát hiện hallucination và yield 'correction' event nếu cần
   * Cuối stream persist lượt chat vào history (nhờ đó câu hỏi follow-up
   * như "cái đầu tiên bao nhiêu tiền?" có context, và messageId trả về
   * trong event 'done' khớp với tin nhắn thật trong DB).
   */
  async *stream(sessionId, userMessage) {
    metrics.chatbotTokensTotal.inc({ direction: 'in' }, metrics.estimateTokens(userMessage));

    const { history, messages } = await this._buildContext(sessionId, userMessage);

    let finalContent = '';
    const boundModel = this.model.bindTools(this.tools);
    const collectedProducts = [];
    const collectedAmounts = [];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Dùng .stream() để token ra client ngay khi LLM sinh (không gom cả câu
      // rồi mới cắt thành từ — cách đó khiến client nhận 1 cục duy nhất).
      const stream = await boundModel.stream(messages);

      let aggregated = null;
      let sawToolCalls = false;
      const pendingTokens = [];

      for await (const chunk of stream) {
        aggregated = aggregated ? aggregated.concat(chunk) : chunk;

        // Chunk mang tool_call_chunks → model đang gọi tool, phần text (nếu có)
        // không phải câu trả lời cuối nên không stream ra client.
        if (chunk.tool_call_chunks?.length || chunk.tool_calls?.length) {
          sawToolCalls = true;
        }

        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (text && !sawToolCalls) {
          pendingTokens.push(text);
        }
      }

      const toolCalls = aggregated?.tool_calls || [];

      if (toolCalls.length === 0) {
        for (const content of pendingTokens) {
          yield { type: 'token', content };
        }
        finalContent = typeof aggregated?.content === 'string' ? aggregated.content : '';
        break;
      }

      // Có tool call → thêm AI message + execute tools
      messages.push(aggregated);
      yield* this._runToolCalls(messages, toolCalls, collectedProducts, collectedAmounts);
    }

    // Vượt max iterations → fallback
    if (!finalContent) {
      finalContent = MAX_ITERATIONS_FALLBACK;
      yield { type: 'token', content: finalContent };
    }

    // Grounding check cho Agent mode: kiểm tra giá và link
    const validated = validateResponse(finalContent, collectedProducts, logger, {
      allowedAmounts: collectedAmounts,
    });
    if (validated !== finalContent) {
      metrics.chatbotHallucinationTotal.inc({ kind: 'replaced_agent' });
      yield { type: 'correction', content: validated };
      finalContent = validated;
    }

    metrics.chatbotTokensTotal.inc({ direction: 'out' }, metrics.estimateTokens(finalContent));

    await this._saveTurnToHistory(history, userMessage, finalContent);
  }
}

module.exports = ChatbotAgent;
