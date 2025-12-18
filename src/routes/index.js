const userRouter = require("./user.router");
const productRouter = require("./product.router");
const orderRouter = require("./order.router");
const authRouter = require("./auth.router");
const categoryRouter = require("./category.router");
const notificationRouter = require("./notification.router");
const reviewRouter = require("./review.router");
const cartRouter = require("./cart.router");
const discountRouter = require("./discount.router");
const statisticsRouter = require("./statistics.router");
const paymentRouter = require("./payment.router");
const bannerRouter = require("./banner.router");


const initRoutes = (app) => {
  app.use("/api/users", userRouter);
  app.use("/api/products", productRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/reviews", reviewRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/discounts", discountRouter);
  app.use("/api/statistics", statisticsRouter);
  app.use("/api/payment", paymentRouter);
  app.use("/api/banners", bannerRouter);

};

module.exports = initRoutes;
