const cors = require('cors');
const logger = require('../utils/logger');
const { isAllowedOrigin } = require('../configs/clientOrigins.config');

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

module.exports = cors(corsOptions);
