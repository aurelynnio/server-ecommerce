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

module.exports = {
  createLiteralRegex,
  normalizeSearchTerm,
};
