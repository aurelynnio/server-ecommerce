/**
 * OpenAPI 3.0 Paths Index
 * Aggregates all modular endpoint definitions
 */

const authPaths = require('./auth.paths');
const userPaths = require('./user.paths');
const productPaths = require('./product.paths');
const orderPaths = require('./order.paths');
const chatbotPaths = require('./chatbot.paths');
const ecommercePaths = require('./ecommerce.paths');

module.exports = {
  ...authPaths,
  ...userPaths,
  ...productPaths,
  ...orderPaths,
  ...chatbotPaths,
  ...ecommercePaths,
};

