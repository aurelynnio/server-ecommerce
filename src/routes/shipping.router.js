
const express = require("express");

const router = express.Router();

const shippingController = require("../controllers/shipping.controller");

const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");

const validate = require("../middlewares/validate.middleware");

const {
  createTemplateValidator,
  updateTemplateValidator,
} = require("../validations/shipping.validator");
// All routes require seller role

router.use(verifyAccessToken, requireRole("seller"));

/**
 * @desc    Create a new shipping template
 * @access  Private (Seller only)
 * @body    { name, description?, baseFee, freeShippingThreshold?, estimatedDays, regions? }
 */
router.post(
  "/",
  validate(createTemplateValidator),
  shippingController.createTemplate
);

/**
 * @desc    Get all shipping templates for current seller's shop
 * @access  Private (Seller only)
 */
router.get("/", shippingController.getMyTemplates);

/**
 * @desc    Update a shipping template
 * @access  Private (Seller only - own templates)
 * @param   templateId - Shipping template ID to update
 * @body    { name?, description?, baseFee?, freeShippingThreshold?, estimatedDays?, regions?, isActive? }
 */
router.put(
  "/:templateId",
  validate(updateTemplateValidator),
  shippingController.updateTemplate
);

/**
 * @desc    Delete a shipping template
 * @access  Private (Seller only - own templates)
 * @param   templateId - Shipping template ID to delete
 */
router.delete("/:templateId", shippingController.deleteTemplate);

module.exports = router;
