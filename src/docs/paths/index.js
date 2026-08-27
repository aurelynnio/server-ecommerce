/**
 * OpenAPI 3.0 Paths Master Index
 * Aggregates all domain routes for 100% complete endpoint coverage
 */

const authPaths = require('./auth.paths');
const userPaths = require('./user.paths');
const productPaths = require('./product.paths');
const categoryPaths = require('./category.paths');
const bannerPaths = require('./banner.paths');
const shopPaths = require('./shop.paths');
const shippingPaths = require('./shipping.paths');
const cartPaths = require('./order.paths'); // contains /api/cart & /api/orders
const paymentPaths = require('./payment.paths');
const voucherPaths = require('./voucher.paths');
const reviewPaths = require('./review.paths');
const wishlistPaths = require('./wishlist.paths');
const notificationPaths = require('./notification.paths');
const searchPaths = require('./search.paths');
const recommendationPaths = require('./recommendation.paths');
const flashSalePaths = require('./flash-sale.paths');
const statisticsPaths = require('./statistics.paths');
const settingsPaths = require('./settings.paths');
const permissionPaths = require('./permission.paths');
const chatPaths = require('./chat.paths');
const chatbotPaths = require('./chatbot.paths');
const healthPaths = require('./health.paths');

module.exports = {
  ...authPaths,
  ...userPaths,
  ...productPaths,
  ...categoryPaths,
  ...bannerPaths,
  ...shopPaths,
  ...shippingPaths,
  ...cartPaths,
  ...paymentPaths,
  ...voucherPaths,
  ...reviewPaths,
  ...wishlistPaths,
  ...notificationPaths,
  ...searchPaths,
  ...recommendationPaths,
  ...flashSalePaths,
  ...statisticsPaths,
  ...settingsPaths,
  ...permissionPaths,
  ...chatPaths,
  ...chatbotPaths,
  ...healthPaths,
};
