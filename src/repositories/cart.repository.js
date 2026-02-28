const Cart = require("../models/cart.model");
const BaseRepository = require("./base.repository");

class CartRepository extends BaseRepository {
  constructor() {
    super(Cart);
  }

  findByUserId(userId) {
    return this.findOneByFilter({ userId });
  }

  findByUserIdLean(userId) {
    return this.findOneByFilter({ userId }).lean();
  }

  findByUserIdWithItemDetails(userId) {
    return this.findOneByFilter({ userId })
      .populate({
        path: "items.productId",
        select: "name slug images price status tierVariations models shop variants sizes",
        populate: [
          { path: "category", select: "name slug" },
          { path: "shop", select: "name logo" },
        ],
      })
      .populate({
        path: "items.shopId",
        select: "name logo",
      })
      .lean();
  }

  createEmptyCart(userId) {
    return this.create({ userId, items: [], totalAmount: 0 });
  }

  findByUserIdForCheckout(userId, session) {
    return this.findOneByFilter({ userId })
      .populate("items.productId")
      .session(session);
  }
}

module.exports = new CartRepository();
