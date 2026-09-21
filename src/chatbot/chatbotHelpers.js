/**
 * Pure helper functions for the chatbot: price/intent parsing, prompt escaping,
 * and product formatting. Kept dependency-free so they can be unit-tested in
 * isolation and keep chatbot.service.js focused on orchestration.
 */

/**
 * Parse a money value with an optional unit (k/nghìn = x1000, tr/triệu = x1e6).
 * @param {string|number|undefined|null} rawValue
 * @param {string} [unit='']
 * @returns {number|null}
 */
function parseMoneyValue(rawValue, unit = '') {
  if (rawValue === undefined || rawValue === null) return null;

  const normalized = String(rawValue)
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;

  const normalizedUnit = (unit || '').toLowerCase();
  if (['k', 'nghìn', 'ngan'].includes(normalizedUnit)) {
    return Math.round(numeric * 1000);
  }
  if (['tr', 'triệu', 'm'].includes(normalizedUnit)) {
    return Math.round(numeric * 1000000);
  }
  return Math.round(numeric);
}

/**
 * Extract a price range (min/max) from a Vietnamese shopping message.
 * Handles "từ X đến Y", "dưới X", "trên X", and unit at the end affecting both bounds.
 * @param {string} message
 * @returns {{minPrice: number|null, maxPrice: number|null}}
 */
function extractPriceRange(message) {
  const rangeMatch = message.match(
    /(?:từ|khoảng|trong khoảng)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?\s*(?:đến|-|tới|~)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
  );
  if (rangeMatch) {
    // Mỗi vế dùng unit riêng của nó. Nếu một vế thiếu unit, fallback về unit của vế
    // kia để bao phủ trường hợp "từ 100 đến 200 nghìn" (cả hai tính theo nghìn).
    const minUnit = rangeMatch[2] || rangeMatch[4];
    const maxUnit = rangeMatch[4] || rangeMatch[2];
    const min = parseMoneyValue(rangeMatch[1], minUnit);
    const max = parseMoneyValue(rangeMatch[3], maxUnit);
    return {
      minPrice: min !== null && max !== null ? Math.min(min, max) : min,
      maxPrice: min !== null && max !== null ? Math.max(min, max) : max,
    };
  }

  const underMatch = message.match(
    /(?:dưới|<=|tối đa|không quá)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
  );
  const aboveMatch = message.match(
    /(?:trên|>=|ít nhất|từ)\s*([\d.,]+)\s*(k|nghìn|ngan|triệu|tr|m)?/i,
  );

  return {
    minPrice: aboveMatch ? parseMoneyValue(aboveMatch[1], aboveMatch[2]) : null,
    maxPrice: underMatch ? parseMoneyValue(underMatch[1], underMatch[2]) : null,
  };
}

/**
 * Extract structured search signals (brand, category, color, size, price, sort)
 * from a Vietnamese shopping message.
 * @param {string} message
 * @returns {Object}
 */
function extractSearchSignals(message) {
  const lowerMessage = message.toLowerCase();
  const priceRange = extractPriceRange(message);

  const cleanValue = (value) =>
    value
      ? value
          .trim()
          .replace(/[?.!,]+$/g, '')
          .trim()
      : null;

  const brandMatch = message.match(/(?:thương hiệu|hãng|brand)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,40})/i);
  const categoryMatch = message.match(/(?:danh mục|loại|category)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,40})/i);
  const colorMatch = message.match(/(?:màu|color)\s+([a-zA-ZÀ-ỹ0-9\s-]{2,30})/i);
  const sizeMatch = message.match(/(?:size|kích cỡ|cỡ)\s*([a-zA-Z0-9]{1,8})/i);

  const limitMatch =
    message.match(/(?:top|lấy|hiển thị|show)\s*(\d{1,2})/i) ||
    message.match(/(\d{1,2})\s*(?:sản phẩm|sp|món)/i);

  const sortBy = /(rẻ nhất|giá thấp|thấp đến cao)/i.test(lowerMessage)
    ? 'price_asc'
    : /(đắt nhất|giá cao|cao đến thấp)/i.test(lowerMessage)
      ? 'price_desc'
      : /(mới nhất|vừa về|newest|new arrival)/i.test(lowerMessage)
        ? 'newest'
        : /(đánh giá cao|top rated|5 sao)/i.test(lowerMessage)
          ? 'rating'
          : 'bestselling';

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
    onlyDiscounted: /(giảm giá|sale|khuyến mãi|discount|ưu đãi)/i.test(lowerMessage),
    sortBy,
    limit,
  };
}

/**
 * Sanitize untrusted text (user message / product name) before injecting it
 * into an LLM prompt, to reduce prompt-injection risk.
 * @param {string|null|undefined} text
 * @returns {string}
 */
function escapePromptText(text) {
  if (!text) return '';
  return (
    String(text)
      // Strip control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '')
      // Collapse the marker tokens attackers might use to override instructions
      .replace(/\[(?:HỆ THỐNG|SYSTEM|INSTRUCTIONS|YÊU CẦU|KHÁCH HỎI)\]/gi, '[nội dung]')
      .trim()
      .slice(0, 2000)
  );
}

/**
 * Normalize a price string like "199.000" / "199,000" / "199000" to a number.
 * @param {string} raw
 * @returns {number|null}
 */
function normalizePriceInText(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/[.,]/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Format a list of products into a compact LLM-readable block.
 * @param {Array} products
 * @returns {string}
 */
function formatProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return 'Không có sản phẩm.';
  }

  return products
    .map((item, index) => {
      if (item.name && item.price !== undefined) {
        const discount =
          item.originalPrice && item.originalPrice > item.price
            ? ` (gốc ${item.originalPrice.toLocaleString('vi-VN')}đ, giảm ${Math.round((1 - item.price / item.originalPrice) * 100)}%)`
            : '';
        const similarity = item.score ? ` [Độ phù hợp: ${(item.score * 100).toFixed(0)}%]` : '';
        const sizes = item.sizes?.length ? `Size: ${item.sizes.join(', ')}\n` : '';
        const colors = item.colors?.length ? `Màu: ${item.colors.join(', ')}\n` : '';
        const image = item.image ? `Ảnh: ${item.image}\n` : '';

        return `[SẢN PHẨM ${index + 1}]${similarity}
Tên: ${item.name}
Giá: ${item.price?.toLocaleString('vi-VN')}đ${discount}
Thương hiệu: ${item.brand || 'N/A'}
Danh mục: ${item.category || 'N/A'}
Còn hàng: ${item.stock > 0 ? 'Có' : 'Hết hàng'}
${sizes}${colors}${image}Link xem: ${item.productUrl}
Link mua: ${item.checkoutUrl}`;
      } else if (item.name && item.slug && item.url) {
        return `- ${item.name}: ${item.url}`;
      }
      return JSON.stringify(item);
    })
    .join('\n\n');
}

/**
 * Validate LLM response to prevent hallucination
 * Check if mentioned links actually exist in the context, and verify price grounding.
 * @param {string} response - LLM response
 * @param {Array} products - Products from RAG or tool calls
 * @param {Object} [logger] - Optional logger instance
 * @returns {string} - Validated/corrected response
 */
function validateResponse(response, products, logger = null) {
  if (!response) return response;

  // Nếu không có product trong context, cảnh báo nếu response chứa giá cụ thể
  if (!products || products.length === 0) {
    const pricePattern = /\d{2,3}[.,]?\d{3}[.,]?\d{0,3}\s*đ/g;
    if (pricePattern.test(response)) {
      if (logger?.warn) {
        logger.warn(
          '[Chatbot] Potential hallucination detected - prices in response but no products in context',
        );
      }
      return 'Em xin lỗi, hiện tại em chưa tìm thấy sản phẩm phù hợp với yêu cầu của anh/chị. Anh/chị có thể cho em biết cụ thể hơn muốn tìm loại sản phẩm gì không ạ? Ví dụ: áo, quần, giày, túi xách...';
    }
    return response;
  }

  // Grounding check: mọi link internal trong response phải nằm trong whitelist
  const allowedUrls = new Set();
  for (const p of products) {
    if (p.productUrl) allowedUrls.add(p.productUrl);
    if (p.checkoutUrl) allowedUrls.add(p.checkoutUrl);
    if (p.image) allowedUrls.add(p.image);
  }

  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  let hallucinated = false;
  while ((match = linkPattern.exec(response)) !== null) {
    const url = match[2];
    // Chặn cả link tuyệt đối ngoài whitelist lẫn link nội bộ không hợp lệ
    const isInternal = url.startsWith('/');
    const isAllowedAbsolute = /^https?:\/\//i.test(url) && allowedUrls.has(url);
    if (isInternal && !allowedUrls.has(url)) {
      if (logger?.warn) {
        logger.warn('[Chatbot] Hallucinated link detected', {
          url,
          allowedSample: Array.from(allowedUrls).slice(0, 3),
        });
      }
      hallucinated = true;
      break;
    }
    if (/^https?:\/\//i.test(url) && !isAllowedAbsolute) {
      if (logger?.warn) {
        logger.warn('[Chatbot] Hallucinated absolute link detected', { url });
      }
      hallucinated = true;
      break;
    }
  }

  if (hallucinated) {
    return 'Xin lỗi, em không thể truy cập sản phẩm này. Anh/chị có thể thử từ khoá khác không ạ?';
  }

  // Grounding check: mọi mức giá xuất hiện phải khớp với dữ liệu thực
  const allowedPrices = new Set();
  for (const p of products) {
    if (typeof p.price === 'number') allowedPrices.add(p.price);
    if (typeof p.originalPrice === 'number') allowedPrices.add(p.originalPrice);
  }
  const priceInTextPattern = /(\d{1,3}(?:[.,]\d{3})+|[1-9]\d{0,4})\s*đ/g;
  let priceMatch;
  while ((priceMatch = priceInTextPattern.exec(response)) !== null) {
    const raw = priceMatch[1];
    const parsed = normalizePriceInText(raw);
    if (parsed !== null && allowedPrices.size > 0 && !allowedPrices.has(parsed)) {
      if (logger?.warn) {
        logger.warn('[Chatbot] Hallucinated price detected', {
          parsed,
          allowedSample: Array.from(allowedPrices).slice(0, 5),
        });
      }
      return 'Xin lỗi, hiện tại em chưa thể xác nhận mức giá đó. Anh/chị có thể thử lại với sản phẩm khác không ạ?';
    }
  }

  return response;
}

module.exports = {
  parseMoneyValue,
  extractPriceRange,
  extractSearchSignals,
  escapePromptText,
  normalizePriceInText,
  formatProducts,
  validateResponse,
};
