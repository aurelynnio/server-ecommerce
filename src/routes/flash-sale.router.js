const express = require("express");
const router = express.Router();
const flashSaleController = require("../controllers/flash-sale.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

// Public routes
router.get("/", flashSaleController.getActiveFlashSale);
router.get("/schedule", flashSaleController.getSchedule);
router.get("/slot/:timeSlot", flashSaleController.getBySlot);

// Admin/Seller routes
router.get("/stats", authenticate, authorize("admin"), flashSaleController.getStats);
router.post(
  "/:productId",
  authenticate,
  authorize("admin", "seller"),
  flashSaleController.addToFlashSale
);
router.delete(
  "/:productId",
  authenticate,
  authorize("admin", "seller"),
  flashSaleController.removeFromFlashSale
);

module.exports = router;
