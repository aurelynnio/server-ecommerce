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

  /**
   * Retrieve relevant products using RAG (semantic search)
   * This replaces the old keyword-based detectAndCallTools
   * @param {string} message - User message
   * @returns {Promise<Array>} - Array of products
   */
  async retrieveProducts(message) {
    const lowerMessage = message.toLowerCase();
    
    // Intent detection for non-search queries
    const greetingKeywords = ["xin chào", "hello", "hi", "chào", "hey"];
    const categoryKeywords = ["danh mục", "loại", "category", "thể loại", "phân loại"];
    const featuredKeywords = ["hot", "nổi bật", "nỗi bật", "bán chạy", "gợi ý", "recommend", "best", "top", "phổ biến"];
    const saleKeywords = ["giảm giá", "sale", "khuyến mãi", "discount", "rẻ", "ưu đãi"];
    const newKeywords = ["mới", "new", "vừa về", "mới nhất", "latest"];
    
    try {
      // Handle greetings - show featured products
      if (greetingKeywords.some((k) => lowerMessage.includes(k))) {
        logger.info("[Chatbot] Detected: greeting - fetching featured products");
        return await getFeaturedProducts({ type: "featured", limit: 3 });
      }
      
      // Handle categories request
      if (categoryKeywords.some((k) => lowerMessage.includes(k))) {
        logger.info("[Chatbot] Detected: categories request");
        return await toolHandlers.get_categories();
      }
      
      // Handle sale products
      if (saleKeywords.some((k) => lowerMessage.includes(k))) {
        logger.info("[Chatbot] Detected: sale products");
        return await getFeaturedProducts({ type: "onSale", limit: 5 });
      }
      
      // Handle new arrivals
      if (newKeywords.some((k) => lowerMessage.includes(k))) {
        logger.info("[Chatbot] Detected: new arrivals");
        return await getFeaturedProducts({ type: "newArrivals", limit: 5 });
      }
      
      // Handle featured products
      if (featuredKeywords.some((k) => lowerMessage.includes(k))) {
        logger.info("[Chatbot] Detected: featured products");
        return await getFeaturedProducts({ type: "featured", limit: 5 });
      }
      
      // For all other queries, use semantic search (RAG)
      if (message.length > 2) {
        logger.info("[Chatbot] Using semantic search for:", message);
        const results = await searchSimilarProducts(message, { limit: 5 });
        
        // If semantic search returns empty, fallback to featured products
        if (results.length === 0) {
          logger.info("[Chatbot] No semantic results, falling back to featured");
          return await getFeaturedProducts({ type: "bestsellers", limit: 5 });
        }
        
        return results;
      }
      
      // Default: show featured products
      logger.info("[Chatbot] Default: showing featured products");
      return await getFeaturedProducts({ type: "featured", limit: 3 });
      
    } catch (error) {
      logger.error("[Chatbot] Error retrieving products:", error.message);
      // Fallback to featured products on error
      return await getFeaturedProducts({ type: "bestsellers", limit: 5 });
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

  // Keep the old method for backward compatibility, but redirect to new RAG method
  async detectAndCallTools(message) {
    return await this.retrieveProducts(message);
  }
}

module.exports = new ChatbotService();
