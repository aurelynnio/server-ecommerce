const defaultDevOrigins = [
  'https://nantianshop.tech',
  'https://www.nantianshop.tech',
  'http://localhost:3001',
  'https://etiso.me',
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return '';
  return origin.trim().replace(/\/+$/, '');
};

const parseOrigins = (value) => {
  return String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
};

const uniqueOrigins = (origins) => [...new Set(origins)];

const getConfiguredFrontendOrigins = () => {
  return uniqueOrigins([
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.FRONTEND_URLS),
  ]);
};

const getAllowedOrigins = () => {
  const configuredOrigins = getConfiguredFrontendOrigins();

  if (process.env.NODE_ENV === 'production') {
    return configuredOrigins;
  }

  return uniqueOrigins([...defaultDevOrigins, ...configuredOrigins]);
};

const isLocalhostOrigin = (origin) => {
  return typeof origin === 'string' && origin.startsWith('http://localhost');
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  if (process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin)) {
    return true;
  }

  return getAllowedOrigins().includes(normalizeOrigin(origin));
};

module.exports = {
  defaultDevOrigins,
  getAllowedOrigins,
  isAllowedOrigin,
  isLocalhostOrigin,
  normalizeOrigin,
};
