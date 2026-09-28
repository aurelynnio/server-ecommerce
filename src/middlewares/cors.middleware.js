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

const isVercelPreviewHost = (url) => {
  return url.protocol === 'https:' && (url.hostname.endsWith('.vercel.app') || url.hostname === 'vercel.app');
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

// Memoize danh sách origin hợp lệ: env không đổi trong vòng đời tiến trình nên
// chỉ dựng Set một lần thay vì tạo mảng + Set mới trên mỗi request.
let allowedOriginsSet = null;
const getAllowedOriginsSet = () => {
  if (!allowedOriginsSet) {
    const defaults =
      process.env.NODE_ENV === 'production' ? defaultProductionOrigins : defaultDevOrigins;
    allowedOriginsSet = new Set([...defaults, ...getConfiguredFrontendOrigins()]);
  }
  return allowedOriginsSet;
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (getAllowedOriginsSet().has(normalized)) return true;

  // Chỉ parse URL khi origin chưa nằm trong allow-list để tránh chi phí thừa.
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    url.hostname === 'localhost'
  ) {
    return true;
  }

  return isVercelPreviewHost(url);
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
