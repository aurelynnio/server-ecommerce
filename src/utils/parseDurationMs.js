/**
 * Parse duration strings like "30m", "1h", "16d" into milliseconds.
 * @param {string|number} value
 * @param {number|null} fallbackMs
 * @returns {number|null}
 */
const parseDurationMs = (value, fallbackMs = null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!value) return fallbackMs;

  const str = String(value).trim().toLowerCase();
  const match = str.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
};

module.exports = parseDurationMs;
