const { ChatMistralAI } = require("@langchain/mistralai");
const { MongoDBChatMessageHistory } = require("@langchain/mongodb");
const {
  ChatPromptTemplate,
  MessagesPlaceholder,
} = require("@langchain/core/prompts");
const { RunnableWithMessageHistory } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const mongoose = require("mongoose");

const { searchSimilarProducts, getFeaturedProducts } = require("./embedding.service");
const { toolHandlers } = require("../utils/chatbot.tools");
const { SYSTEM_PROMPT } = require("../configs/chatbot.config");
const logger = require("../utils/logger");

class ChatbotService {
  constructor() {
    this.model = new ChatMistralAI({
      model: "mistral-large-latest",
      apiKey: process.env.MISTRAL_API_KEY,
      temperature: 0.3,
      streaming: true,
    });

    this.prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);

    this.chain = this.prompt.pipe(this.model).pipe(new StringOutputParser());
  }

  /**
   * Get message history
   * @param {string} sessionId
   * @returns {any}
   */
  getMessageHistory(sessionId) {
    const client = mongoose.connection.getClient();
    const collection = client.db().collection("chatbot_messages");

    return new MongoDBChatMessageHistory({
      collection,
      sessionId,
    });
  }

  /**
   * Stream chat response using RAG
   * @param {string} sessionId
   * @param {string} userMessage
   * @param {Function} onToken - Callback for each token
   * @returns {Promise<{success: boolean, message: string, sessionId: string}>}
   */
  async chatStream(sessionId, userMessage, onToken) {
    try {
      logger.info("[Chatbot] Starting RAG stream chat with sessionId:", sessionId);
      logger.info("[Chatbot] User message:", userMessage);

      // Use RAG to retrieve relevant products
      const products = await this.retrieveProducts(userMessage);

      logger.info(
        "[Chatbot] RAG retrieved:",
        products.length > 0 ? `Found ${products.length} products` : "No products found"
      );

      // Build context from retrieved products
      const contextMessage = this.buildContextMessage(userMessage, products);

      // Create chain with message history
      const chainWithHistory = new RunnableWithMessageHistory({
        runnable: this.chain,
        getMessageHistory: (sessionId) => this.getMessageHistory(sessionId),
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
      });

      // Stream response
      let fullResponse = "";
      const stream = await chainWithHistory.stream(
        { input: contextMessage },
        { configurable: { sessionId } }
      );

      for await (const chunk of stream) {
        fullResponse += chunk;
        if (onToken) {
          onToken(chunk);
        }
      }

      logger.info("[Chatbot] Stream completed");

      // Validate response before returning
      const validatedResponse = this.validateResponse(fullResponse, products);

      return {
        success: true,
        message: validatedResponse,
        sessionId,
      };
    } catch (error) {
      logger.error("[Chatbot] Stream error:", error.message);
      return {
        success: false,
        message:
          "Xin lỗi, hệ thống đang bận. Anh/chị vui lòng thử lại sau nhé!",
        error: error.message,
        sessionId,
      };
    }
  }

  /**
   * Non-streaming chat (fallback)
   */
  async chat(sessionId, userMessage) {
    try {
      logger.info("[Chatbot] Starting RAG chat with sessionId:", sessionId);
      logger.info("[Chatbot] User message:", userMessage);

      // Use RAG to retrieve relevant products
      const products = await this.retrieveProducts(userMessage);
      
      logger.info(
        "[Chatbot] RAG retrieved:",
        products.length > 0 ? `Found ${products.length} products` : "No products found"
      );

      const contextMessage = this.buildContextMessage(userMessage, products);

      const chainWithHistory = new RunnableWithMessageHistory({
        runnable: this.chain,
        getMessageHistory: (sessionId) => this.getMessageHistory(sessionId),
        inputMessagesKey: "input",
        historyMessagesKey: "chat_history",
      });

      const result = await chainWithHistory.invoke(
        { input: contextMessage },
        { configurable: { sessionId } }
      );

      logger.info("[Chatbot] Response generated successfully");

      // Validate response before returning
      const validatedResponse = this.validateResponse(result, products);

      return {
        success: true,
        message: validatedResponse,
        sessionId,
      };
    } catch (error) {
      logger.error("[Chatbot] Error:", error.message);
      return {
        success: false,
        message:
          "Xin lỗi, hệ thống đang bận. Anh/chị vui lòng thử lại sau nhé!",
        error: error.message,
        sessionId,
      };
    }
  }

  parseMoneyValue(rawValue, unit = "") {
    if (rawValue === undefined || rawValue === null) return null;

    const normalized = String(rawValue)
      .trim()
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;

    const normalizedUnit = unit.toLowerCase();
    if (["k", "nghìn", "ngan"].includes(normalizedUnit)) {
      return Math.round(numeric * 1000);
    }
    if (["tr", "triệu", "m"].includes(normalizedUnit)) {
      return Math.round(numeric * 1000000);
    }
    return Math.round(numeric);
  }

  extractPriceRange(message) {
    const rangeMatch = message.match(
      /(?:từ|khoảng)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?\s*(?:đến|-|tới|~)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
    );
    if (rangeMatch) {
      const min = this.parseMoneyValue(rangeMatch[1], rangeMatch[2]);
      const max = this.parseMoneyValue(rangeMatch[3], rangeMatch[4]);
      return {
        minPrice: min !== null && max !== null ? Math.min(min, max) : min,
        maxPrice: min !== null && max !== null ? Math.max(min, max) : max,
      };
    }

    const underMatch = message.match(
      /(?:dưới|<=|tối đa|không quá)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
    );
    const aboveMatch = message.match(
      /(?:trên|>=|ít nhất)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
    );

    return {
      minPrice: aboveMatch
        ? this.parseMoneyValue(aboveMatch[1], aboveMatch[2])
        : null,
      maxPrice: underMatch
        ? this.parseMoneyValue(underMatch[1], underMatch[2])
        : null,
    };
  }

  extractSearchSignals(message) {
    const lowerMessage = message.toLowerCase();
    const priceRange = this.extractPriceRange(message);

    const cleanValue = (value) =>
      value ? value.trim().replace(/[?.!,]+$/g, "").trim() : null;

    const brandMatch = message.match(
      /(?:thương hiệu|hãng|brand)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,40})/i,
    );
    const categoryMatch = message.match(
      /(?:danh mục|loại|category)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,40})/i,
    );
    const colorMatch = message.match(
      /(?:màu|color)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,30})/i,
    );
    const sizeMatch = message.match(/(?:size|kích cỡ|cỡ)\s*([a-zA-Z0-9]{1,8})/i);

    const limitMatch =
      message.match(/(?:top|lấy|hiển thị|show)\s*(\d{1,2})/i) ||
      message.match(/(\d{1,2})\s*(?:sản phẩm|sp|món)/i);

    const sortBy = /(rẻ nhất|giá thấp|thấp đến cao)/i.test(lowerMessage)
      ? "price_asc"
      : /(đắt nhất|giá cao|cao đến thấp)/i.test(lowerMessage)
        ? "price_desc"
        : /(mới nhất|vừa về|newest|new arrival)/i.test(lowerMessage)
          ? "newest"
          : /(đánh giá cao|top rated|5 sao)/i.test(lowerMessage)
            ? "rating"
            : "bestselling";

    const limit = limitMatch ? Math.min(Math.max(Number(limitMatch[1]), 1), 20) : 5;

    return {
      brand: cleanValue(brandMatch?.[1]),
      category: cleanValue(categoryMatch?.[1]),
      colors: cleanValue(colorMatch?.[1]) ? [cleanValue(colorMatch[1])] : [],
      sizes: cleanValue(sizeMatch?.[1]) ? [cleanValue(sizeMatch[1])] : [],
      minPrice: priceRange.minPrice,
      maxPrice: priceRange.maxPrice,
      hasPriceFilter: priceRange.minPrice !== null || priceRange.maxPrice !== null,
      inStockOnly: /(còn hàng|sẵn hàng|available|in stock)/i.test(lowerMessage),
      onlyDiscounted: /(giảm giá|sale|khuyến mãi|discount|ưu đãi)/i.test(
        lowerMessage,
      ),
      sortBy,
      limit,
    };
  }

  normalizeProductList(result) {
    return Array.isArray(result) ? result : [];
  }

  /**
   * Retrieve relevant products using semantic search + structured tools
   * @param {string} message - User message
   * @returns {Promise<Array>} - Array of products
   */
  async retrieveProducts(message) {
    const lowerMessage = message.toLowerCase();
    const signals = this.extractSearchSignals(message);

    const greetingKeywords = ["xin chào", "hello", "hi", "chào", "hey"];
    const categoryKeywords = ["danh mục", "loại", "category", "thể loại", "phân loại"];
    const featuredKeywords = ["hot", "nổi bật", "nỗi bật", "gợi ý", "recommend", "best", "top", "phổ biến"];
    const saleKeywords = ["giảm giá", "sale", "khuyến mãi", "discount", "ưu đãi"];
    const bestsellerKeywords = ["bán chạy", "best seller", "best-seller", "phổ biến"];
    const newKeywords = ["mới", "new", "vừa về", "mới nhất", "latest"];

    try {
      if (greetingKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: greeting - fetching featured products");
        return await getFeaturedProducts({ type: "featured", limit: 3 });
      }

      if (categoryKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: categories request");
        return this.normalizeProductList(await toolHandlers.get_categories());
      }

      if (signals.onlyDiscounted || saleKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: discounted products");
        const discounted = this.normalizeProductList(
          await toolHandlers.get_discounted_products({
            keyword: signals.brand || signals.category ? undefined : message,
            category: signals.category,
            minPrice: signals.minPrice,
            maxPrice: signals.maxPrice,
            inStockOnly: signals.inStockOnly,
            limit: signals.limit,
          }),
        );
        if (discounted.length > 0) return discounted;
      }

      if (bestsellerKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: bestseller products");
        const bestsellers = this.normalizeProductList(
          await toolHandlers.get_bestseller_products({
            category: signals.category,
            brand: signals.brand,
            limit: signals.limit,
          }),
        );
        if (bestsellers.length > 0) return bestsellers;
      }

      if (newKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: new arrival products");
        const newArrivals = this.normalizeProductList(
          await toolHandlers.get_new_arrival_products({
            category: signals.category,
            brand: signals.brand,
            limit: signals.limit,
          }),
        );
        if (newArrivals.length > 0) return newArrivals;
      }

      const hasAdvancedFilters =
        signals.hasPriceFilter ||
        !!signals.brand ||
        !!signals.category ||
        signals.colors.length > 0 ||
        signals.sizes.length > 0 ||
        signals.inStockOnly ||
        signals.sortBy !== "bestselling";

      if (hasAdvancedFilters) {
        logger.info("[Chatbot] Using advanced product search tools");
        const advancedResults = this.normalizeProductList(
          await toolHandlers.search_products_advanced({
            keyword: signals.brand || signals.category || signals.hasPriceFilter ? undefined : message,
            category: signals.category,
            brand: signals.brand,
            minPrice: signals.minPrice,
            maxPrice: signals.maxPrice,
            colors: signals.colors,
            sizes: signals.sizes,
            inStockOnly: signals.inStockOnly,
            onlyDiscounted: signals.onlyDiscounted,
            sortBy: signals.sortBy,
            limit: signals.limit,
          }),
        );
        if (advancedResults.length > 0) return advancedResults;
      }

      if (featuredKeywords.some((keyword) => lowerMessage.includes(keyword))) {
        logger.info("[Chatbot] Detected: featured products");
        return await getFeaturedProducts({ type: "featured", limit: 5 });
      }

      if (message.length > 2) {
        logger.info("[Chatbot] Using semantic search for:", message);
        const results = await searchSimilarProducts(message, { limit: signals.limit });
        if (results.length > 0) return results;

        logger.info("[Chatbot] No semantic results, fallback to bestsellers");
        const fallback = this.normalizeProductList(
          await toolHandlers.get_bestseller_products({ limit: 5 }),
        );
        if (fallback.length > 0) return fallback;
      }

      logger.info("[Chatbot] Default: showing featured products");
      return await getFeaturedProducts({ type: "featured", limit: 3 });
    } catch (error) {
      logger.error("[Chatbot] Error retrieving products:", error.message);
      const fallback = this.normalizeProductList(
        await toolHandlers.get_bestseller_products({ limit: 5 }),
      );
      if (fallback.length > 0) return fallback;
      return await getFeaturedProducts({ type: "featured", limit: 3 });
    }
  }

  /**
   * Build context message for the LLM
   * @param {string} userMessage
   * @param {Array} products
   * @returns {string}
   */
  buildContextMessage(userMessage, products) {
    if (products && Array.isArray(products) && products.length > 0) {
      const formattedData = this.formatProducts(products);
      return `[KHÁCH HỎI]: ${userMessage}

[DỮ LIỆU SẢN PHẨM THỰC TẾ - CHỈ DÙNG THÔNG TIN NÀY]:
${formattedData}

[YÊU CẦU QUAN TRỌNG]: 
- CHỈ giới thiệu ĐÚNG các sản phẩm ở trên
- PHẢI dùng ĐÚNG tên, giá, link như trong dữ liệu
- TUYỆT ĐỐI KHÔNG được bịa thêm sản phẩm khác
- Nếu khách hỏi về sản phẩm không có trong danh sách → nói "Em chưa tìm thấy sản phẩm phù hợp, anh/chị có thể mô tả thêm không ạ?"`;
    }

    logger.info("[Chatbot] No products found, using default message");
    return `[KHÁCH HỎI]: ${userMessage}

[THÔNG BÁO]: Không tìm thấy sản phẩm phù hợp trong hệ thống.

[YÊU CẦU]: 
- Xin lỗi khách vì chưa tìm thấy sản phẩm phù hợp
- Hỏi khách muốn tìm loại sản phẩm gì cụ thể hơn (áo, quần, giày...)
- KHÔNG được bịa ra bất kỳ sản phẩm nào`;
  }

  /**
   * Format products for LLM context
   * @param {Array} products
   * @returns {string}
   */
  formatProducts(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return "Không có sản phẩm.";
    }

    return products
      .map((item, index) => {
        if (item.name && item.price !== undefined) {
          // Product format
          const discount =
            item.originalPrice && item.originalPrice > item.price
              ? ` (gốc ${item.originalPrice.toLocaleString("vi-VN")}đ, giảm ${Math.round((1 - item.price / item.originalPrice) * 100)}%)`
              : "";
          const similarity = item.score ? ` [Độ phù hợp: ${(item.score * 100).toFixed(0)}%]` : "";
          
          return `[SẢN PHẨM ${index + 1}]${similarity}
Tên: ${item.name}
Giá: ${item.price?.toLocaleString("vi-VN")}đ${discount}
Thương hiệu: ${item.brand || "N/A"}
Danh mục: ${item.category || "N/A"}
Còn hàng: ${item.stock > 0 ? "Có" : "Hết hàng"}
Link xem: ${item.productUrl}
Link mua: ${item.checkoutUrl}`;
        } else if (item.name && item.slug && item.url) {
          // Category format
          return `- ${item.name}: ${item.url}`;
        }
        return JSON.stringify(item);
      })
      .join("\n\n");
  }

  /**
   * Validate LLM response to prevent hallucination
   * Check if mentioned products actually exist in the context
   * @param {string} response - LLM response
   * @param {Array} products - Products from RAG
   * @returns {string} - Validated/corrected response
   */
  validateResponse(response, products) {
    // If no products were provided, add a warning if the response mentions specific products
    if (!products || products.length === 0) {
      // Check if response contains price patterns (potential hallucination)
      const pricePattern = /\d{2,3}[.,]?\d{3}[.,]?\d{0,3}\s*đ/g;
      const hasPrices = pricePattern.test(response);
      
      if (hasPrices) {
        logger.warn("[Chatbot] Potential hallucination detected - prices in response but no products in context");
        // Return a safe response
        return "Em xin lỗi, hiện tại em chưa tìm thấy sản phẩm phù hợp với yêu cầu của anh/chị. Anh/chị có thể cho em biết cụ thể hơn muốn tìm loại sản phẩm gì không ạ? Ví dụ: áo, quần, giày, túi xách...";
      }
    }
    
    // For now, return the response as-is
    // More sophisticated validation can be added here
    return response;
  }

  /**
   * Backward-compatible wrapper for legacy tool detection
   * Redirects to RAG-based product retrieval
   * @param {string} message - User message
   * @returns {Promise<Array>} Retrieved products
   */
  async detectAndCallTools(message) {
    return await this.retrieveProducts(message);
  }
}

module.exports = new ChatbotService();
