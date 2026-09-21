const cors = require('cors');
const logger = require('../utils/logger');

const defaultProductionOrigins = [
  'https://nantianshop.tech',
  'https://www.nantianshop.tech',
  'http://nantianshop.tech',
  'http://www.nantianshop.tech',
];

const defaultDevOrigins = [
  ...defaultProductionOrigins,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://etiso.me',
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return '';
  return origin.trim().replace(/\/+$/, '');
};

const isVercelPreviewOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname.endsWith('.vercel.app') || url.hostname === 'vercel.app')
    );
  } catch {
    return false;
  }
};

const getConfiguredFrontendOrigins = () => {
  return [
    ...new Set(
      [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
        .flatMap((value) => String(value || '').split(','))
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  ];
};

const getAllowedOrigins = () => {
  const defaults =
    process.env.NODE_ENV === 'production' ? defaultProductionOrigins : defaultDevOrigins;

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

  const normalized = normalizeOrigin(origin);
  return (
    (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) ||
    isVercelPreviewOrigin(origin) ||
    getAllowedOrigins().includes(normalized)
  );
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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-async-processing',
    'x-async',
    'Cache-Control',
    'Pragma',
  ],
  maxAge: 86400,
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.isAllowedOrigin = isAllowedOrigin;
