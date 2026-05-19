const Shop = require('../repositories/shop.repository');
const { ensureFound } = require('./serviceAssertions');

const getOwnedShopOrThrow = async (ownerId, message = 'Shop not found') =>
  ensureFound(await Shop.findByOwnerId(ownerId), message);

module.exports = {
  getOwnedShopOrThrow,
};
