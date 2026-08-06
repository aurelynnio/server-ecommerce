// Redact PII patterns from text before logging.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(0|\+84)[\d\s.-]{8,12}\d/g;
const CC_RE = /\b(?:\d[ -]?){13,19}\b/g;

const redact = (text = '') =>
  String(text)
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(CC_RE, '[REDACTED_CARD]');

const redactObject = (obj) => {
  if (!obj) return obj;
  if (typeof obj === 'string') return redact(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = redactObject(v);
    }
    return out;
  }
  return obj;
};

module.exports = { redact, redactObject };
