const userRouter = require("./user.router");
const productRouter = require("./product.router");
const orderRouter = require("./order.router");
const authRouter = require("./auth.router");
const categoryRouter = require("./category.router");
const notificationRouter = require("./notification.router");
const reviewRouter = require("./review.router");
const cartRouter = require("./cart.router");
// const discountRouter = require("./discount.router"); // Removed
const statisticsRouter = require("./statistics.router");
const paymentRouter = require("./payment.router");
const bannerRouter = require("./banner.router");
const chatbotRouter = require("./chatbot.router");

// New Routers
const shopRouter = require("./shop.router");
const shippingRouter = require("./shipping.router");
const voucherRouter = require("./voucher.router");
const chatRouter = require("./chat.router");
const shopCategoryRouter = require("./shop.category.router");

const initRoutes = (app) => {
  app.use("/api/users", userRouter);
  app.use("/api/products", productRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/cart", cartRouter);
  // app.use("/api/discounts", discountRouter); // Removed
  app.use("/api/statistics", statisticsRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/api/banners", bannerRouter);
  app.use("/api/chatbot", chatbotRouter);

  // New Routes
  app.use("/api/shops", shopRouter);
  app.use("/api/shipping", shippingRouter);
  app.use("/api/vouchers", voucherRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/shop-categories", shopCategoryRouter);
};

module.exports = initRoutes;
