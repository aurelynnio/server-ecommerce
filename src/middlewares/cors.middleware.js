const cors = require('cors');
const logger = require('../utils/logger');

const defaultProductionOrigins = [
  'https://nantianshop.tech',
  'https://www.nantianshop.tech',
];

const defaultDevOrigins = [
  ...defaultProductionOrigins,
  'http://localhost:3001',
  'https://etiso.me',
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return '';
  return origin.trim().replace(/\/+$/, '');
};

const getConfiguredFrontendOrigins = () => {
  return [...new Set(
    [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
      .flatMap((value) => String(value || '').split(','))
      .map(normalizeOrigin)
      .filter(Boolean),
  )];
};

const getAllowedOrigins = () => {
  const defaults = process.env.NODE_ENV === 'production'
    ? defaultProductionOrigins
    : defaultDevOrigins;

  return [...new Set([...defaults, ...getConfiguredFrontendOrigins()])];
};

const isLocalhostOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.hostname === 'localhost';
  } catch {
    return false;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  return (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin))
    || getAllowedOrigins().includes(normalizeOrigin(origin));
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    logger.warn(`Blocked by CORS: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type'],
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.isAllowedOrigin = isAllowedOrigin;
