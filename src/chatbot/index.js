const { ChatMistralAI } = require("@langchain/mistralai");
const { MongoDBChatMessageHistory } = require("@langchain/mongodb");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { RunnableWithMessageHistory } = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const mongoose = require("mongoose");

const { toolHandlers } = require("./tools");
const { SYSTEM_PROMPT } = require("./prompts");

class ChatbotService {
  constructor() {
    this.model = new ChatMistralAI({
      model: "mistral-large-latest",
      apiKey: process.env.MISTRAL_API_KEY,
      temperature: 0.3,
      streaming: true, // Enable streaming
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
   * Stream chat response
   * @param {string} sessionId 
   * @param {string} userMessage 
   * @param {Function} onToken - Callback for each token
   * @returns {Promise<{success: boolean, message: string, sessionId: string}>}
   */
  async chatStream(sessionId, userMessage, onToken) {
    try {
      console.log("[Chatbot] Starting stream chat with sessionId:", sessionId);
      console.log("[Chatbot] User message:", userMessage);

      // Detect intent and call tools
      const toolResult = await this.detectAndCallTools(userMessage);
      
      console.log("[Chatbot] Tool result:", toolResult ? `Found ${Array.isArray(toolResult) ? toolResult.length : 1} items` : "No data");

      // Build context from tool results
      const contextMessage = this.buildContextMessage(userMessage, toolResult);

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

      console.log("[Chatbot] Stream completed");

      return {
        success: true,
        message: fullResponse,
        sessionId,
      };

    } catch (error) {
      console.error("[Chatbot] Stream error:", error.message);
      return {
        success: false,
        message: "Xin lỗi, hệ thống đang bận. Anh/chị vui lòng thử lại sau nhé! 🙏",
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
      console.log("[Chatbot] Starting chat with sessionId:", sessionId);
      console.log("[Chatbot] User message:", userMessage);

      const toolResult = await this.detectAndCallTools(userMessage);
      console.log("[Chatbot] Tool result:", toolResult ? `Found ${Array.isArray(toolResult) ? toolResult.length : 1} items` : "No data");

      const contextMessage = this.buildContextMessage(userMessage, toolResult);

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

      console.log("[Chatbot] Response generated successfully");

      return {
        success: true,
        message: result,
        sessionId,
      };

    } catch (error) {
      console.error("[Chatbot] Error:", error.message);
      return {
        success: false,
        message: "Xin lỗi, hệ thống đang bận. Anh/chị vui lòng thử lại sau nhé! 🙏",
        error: error.message,
        sessionId,
      };
    }
  }

  buildContextMessage(userMessage, toolResult) {
    if (toolResult && !toolResult.error && (Array.isArray(toolResult) ? toolResult.length > 0 : true)) {
      const formattedData = this.formatToolResult(toolResult);
      return `[KHÁCH HỎI]: ${userMessage}

[DỮ LIỆU SẢN PHẨM - CHỈ DÙNG THÔNG TIN NÀY]:
${formattedData}

[YÊU CẦU]: Giới thiệu ĐÚNG các sản phẩm trên với tên, giá, link chính xác. KHÔNG thêm sản phẩm khác.`;
    }
    
    console.log("[Chatbot] No tool data, using default message");
    return `[KHÁCH HỎI]: ${userMessage}

[DỮ LIỆU]: Không tìm thấy sản phẩm phù hợp.

[YÊU CẦU]: Chào khách và hỏi họ muốn tìm loại sản phẩm gì cụ thể (áo, quần, giày...).`;
  }

  formatToolResult(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "Không có sản phẩm.";
      }
      
      return data.map((item, index) => {
        if (item.name && item.price !== undefined) {
          // Product format - clear and structured
          const discount = item.originalPrice && item.originalPrice > item.price 
            ? ` (gốc ${item.originalPrice.toLocaleString('vi-VN')}đ)` 
            : '';
          return `[SẢN PHẨM ${index + 1}]
Tên: ${item.name}
Giá: ${item.price?.toLocaleString('vi-VN')}đ${discount}
Thương hiệu: ${item.brand || 'N/A'}
Link xem: ${item.productUrl}
Link mua: ${item.checkoutUrl}`;
        } else if (item.name && item.slug) {
          // Category format
          return `- ${item.name}: ${item.url}`;
        }
        return JSON.stringify(item);
      }).join('\n\n');
    }
    
    // Single product detail
    if (data.name && data.variants) {
      const variants = data.variants?.map(v => 
        `  + ${v.size || ''} ${v.color || ''}: còn ${v.stock} - ${v.price?.toLocaleString('vi-VN') || 'N/A'}đ`
      ).join('\n') || 'Không có variant';
      
      return `[CHI TIẾT SẢN PHẨM]
Tên: ${data.name}
Giá: ${data.price?.toLocaleString('vi-VN')}đ
Mô tả: ${data.description || 'N/A'}
Thương hiệu: ${data.brand || 'N/A'}
Danh mục: ${data.category || 'N/A'}
Variants:
${variants}
Link xem: ${data.productUrl}
Link mua: ${data.checkoutUrl}`;
    }

    return JSON.stringify(data, null, 2);
  }

  async detectAndCallTools(message) {
    const lowerMessage = message.toLowerCase();

    // Keywords for different intents
    const featuredKeywords = ['hot', 'nổi bật', 'nỗi bật', 'bán chạy', 'gợi ý', 'recommend', 'best', 'top', 'phổ biến'];
    const searchKeywords = ['tìm', 'search', 'muốn mua', 'cần', 'kiếm', 'bán', 'xem', 'cho xem', 'show'];
    const saleKeywords = ['giảm giá', 'sale', 'khuyến mãi', 'discount', 'rẻ', 'ưu đãi'];
    const newKeywords = ['mới', 'new', 'vừa về', 'mới nhất', 'latest'];
    const categoryKeywords = ['danh mục', 'loại', 'category', 'thể loại', 'phân loại'];
    const greetingKeywords = ['xin chào', 'hello', 'hi', 'chào', 'hey'];

    // Check greeting - still fetch some products to show
    if (greetingKeywords.some(k => lowerMessage.includes(k))) {
      console.log("[Chatbot] Detected: greeting - fetching featured products");
      return await toolHandlers.get_featured_products({ type: "featured", limit: 3 });
    }

    // Check categories
    if (categoryKeywords.some(k => lowerMessage.includes(k))) {
      console.log("[Chatbot] Detected: categories");
      return await toolHandlers.get_categories();
    }

    // Check sale products
    if (saleKeywords.some(k => lowerMessage.includes(k))) {
      console.log("[Chatbot] Detected: sale products");
      return await toolHandlers.get_featured_products({ type: "onSale", limit: 5 });
    }

    // Check new arrivals
    if (newKeywords.some(k => lowerMessage.includes(k))) {
      console.log("[Chatbot] Detected: new arrivals");
      return await toolHandlers.get_featured_products({ type: "newArrivals", limit: 5 });
    }

    // Check featured/hot products
    if (featuredKeywords.some(k => lowerMessage.includes(k))) {
      console.log("[Chatbot] Detected: featured products");
      return await toolHandlers.get_featured_products({ type: "featured", limit: 5 });
    }

    // Check search - extract keyword
    if (searchKeywords.some(k => lowerMessage.includes(k))) {
      // Remove common words to get search keyword
      let keyword = message;
      const removeWords = [
        'tìm', 'search', 'muốn mua', 'cần', 'kiếm', 'có', 'bán', 'xem', 'cho xem', 'show',
        'cho', 'tôi', 'em', 'anh', 'chị', 'mình', 'giúp', 'với', 'đi', 'nha', 'nhé', 'ạ',
        'sản phẩm', 'hàng', 'đồ', 'cái', 'chiếc', 'bộ'
      ];
      removeWords.forEach(word => {
        keyword = keyword.replace(new RegExp(word, 'gi'), '');
      });
      keyword = keyword.trim();
      
      if (keyword.length > 1) {
        console.log("[Chatbot] Detected: search with keyword:", keyword);
        return await toolHandlers.search_products({ keyword, limit: 5 });
      }
    }

    // Default: return featured products for any product-related query
    const productRelatedWords = ['áo', 'quần', 'giày', 'dép', 'túi', 'mũ', 'váy', 'đầm', 'jacket', 'hoodie', 'shirt', 'jean'];
    if (productRelatedWords.some(w => lowerMessage.includes(w))) {
      // Extract the product type as keyword
      const foundWord = productRelatedWords.find(w => lowerMessage.includes(w));
      console.log("[Chatbot] Detected: product keyword:", foundWord);
      return await toolHandlers.search_products({ keyword: foundWord, limit: 5 });
    }

    // If nothing matched but seems like a product query, search with full message
    if (message.length > 3 && !lowerMessage.includes('cảm ơn') && !lowerMessage.includes('ok') && !lowerMessage.includes('được')) {
      console.log("[Chatbot] Fallback: searching with full message");
      return await toolHandlers.search_products({ keyword: message, limit: 5 });
    }

    console.log("[Chatbot] No tool matched");
    return null;
  }
}

module.exports = new ChatbotService();
