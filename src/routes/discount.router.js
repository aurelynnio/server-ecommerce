const express = require("express");
const router = express.Router();
const discountController = require("../controllers/discount.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createDiscountValidator,
  updateDiscountValidator,
  applyDiscountValidator,
  discountIdParamValidator,
  discountCodeParamValidator,
  getDiscountsQueryValidator,
} = require("../validations/discount.validator");

// Public routes (no authentication required)
router.get(
  "/active",
  validate({ query: getDiscountsQueryValidator }),
  discountController.getActiveDiscounts
);
router.get(
  "/code/:code",
  validate({ params: discountCodeParamValidator }),
  discountController.getDiscountByCode
);

// User routes (require authentication)
router.post(
  "/apply",
  verifyAccessToken,
  validate(applyDiscountValidator),
  discountController.applyDiscount
);

// Admin routes (require admin role)
router.post(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate(createDiscountValidator),
  discountController.createDiscount
);
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getDiscountsQueryValidator }),
  discountController.getAllDiscounts
);
router.get(
  "/statistics",
  verifyAccessToken,
  requireRole("admin"),
  discountController.getDiscountStatistics
);
router.get(
  "/:discountId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: discountIdParamValidator }),
  discountController.getDiscountById
);
router.put(
  "/:discountId",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: discountIdParamValidator,
    body: updateDiscountValidator,
  }),
  discountController.updateDiscount
);
router.delete(
  "/:discountId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: discountIdParamValidator }),
  discountController.deleteDiscount
);

module.exports = router;

