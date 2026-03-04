const crypto = require('crypto');

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const normalizeForStableStringify = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableStringify);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sortedObject = {};
  const keys = Object.keys(value).sort();

  keys.forEach((key) => {
    const normalized = normalizeForStableStringify(value[key]);
    if (normalized !== undefined) {
      sortedObject[key] = normalized;
    }
  });

  return sortedObject;
};

const stableStringify = (value) => JSON.stringify(normalizeForStableStringify(value));

const hashQueryParams = (params, algorithm = 'sha256') =>
  crypto.createHash(algorithm).update(stableStringify(params)).digest('hex');

const buildHashedCacheKey = (prefix, params, algorithm = 'sha256') =>
  `${prefix}:${hashQueryParams(params, algorithm)}`;

module.exports = {
  stableStringify,
  hashQueryParams,
  buildHashedCacheKey,
};
