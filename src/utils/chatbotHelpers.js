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
    // If only one side declares a unit, apply it to both sides
    // (e.g. "từ 100 đến 200 nghìn" → both in nghìn).
    const unit = rangeMatch[2] || rangeMatch[4];
    const min = parseMoneyValue(rangeMatch[1], unit);
    const max = parseMoneyValue(rangeMatch[3], unit);
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
  return String(text)
    // Strip control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    // Collapse the marker tokens attackers might use to override instructions
    .replace(/\[(?:HỆ THỐNG|SYSTEM|INSTRUCTIONS|YÊU CẦU|KHÁCH HỎI)\]/gi, '[nội dung]')
    .trim()
    .slice(0, 2000);
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

        return `[SẢN PHẨM ${index + 1}]${similarity}
Tên: ${item.name}
Giá: ${item.price?.toLocaleString('vi-VN')}đ${discount}
Thương hiệu: ${item.brand || 'N/A'}
Danh mục: ${item.category || 'N/A'}
Còn hàng: ${item.stock > 0 ? 'Có' : 'Hết hàng'}
Link xem: ${item.productUrl}
Link mua: ${item.checkoutUrl}`;
      } else if (item.name && item.slug && item.url) {
        return `- ${item.name}: ${item.url}`;
      }
      return JSON.stringify(item);
    })
    .join('\n\n');
}

module.exports = {
  parseMoneyValue,
  extractPriceRange,
  extractSearchSignals,
  escapePromptText,
  normalizePriceInText,
  formatProducts,
};