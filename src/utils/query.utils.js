const MAX_SEARCH_TERM_LENGTH = 200;

function normalizeSearchTerm(value) {
  return String(value ?? '')
    .trim()
    .slice(0, MAX_SEARCH_TERM_LENGTH);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLiteralRegex(value, { match = 'contains' } = {}) {
  const normalizedValue = normalizeSearchTerm(value);
  if (!normalizedValue) return null;

  const escapedValue = escapeRegex(normalizedValue);
  const prefix = match === 'prefix' || match === 'exact' ? '^' : '';
  const suffix = match === 'exact' ? '$' : '';

  return new RegExp(`${prefix}${escapedValue}${suffix}`, 'i');
}

function isValidObjectId(value) {
  if (!value) return false;
  const str = String(value);
  return /^[0-9a-fA-F]{24}$/.test(str);
}

function toFiniteNumber(value, fallback = null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Formats aggregated MongoDB monthly stats into continuous chronological chart points
 * @param {Array<{_id: {month: number, year: number}, revenue: number, orders: number}>} monthlyStatsRaw
 * @param {number} [monthsCount=6]
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<{month: string, revenue: number, orders: number}>}
 */
function buildMonthlyChartData(monthlyStatsRaw = [], monthsCount = 6, referenceDate = new Date()) {
  const lastMonths = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    lastMonths.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      key: `${d.getMonth() + 1}/${d.getFullYear()}`,
    });
  }

  const statsMap = {};
  monthlyStatsRaw.forEach((item) => {
    if (item && item._id) {
      const key = `${item._id.month}/${item._id.year}`;
      statsMap[key] = { revenue: item.revenue || 0, orders: item.orders || 0 };
    }
  });

  return lastMonths.map((time) => {
    const data = statsMap[time.key] || { revenue: 0, orders: 0 };
    return {
      month: `T${time.month}`,
      revenue: data.revenue,
      orders: data.orders,
    };
  });
}

module.exports = {
  createLiteralRegex,
  normalizeSearchTerm,
  isValidObjectId,
  toFiniteNumber,
  buildMonthlyChartData,
};


