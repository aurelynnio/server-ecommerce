const catchAsync = require("../configs/catchAsync");
const discountService = require("../services/discount.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

const DiscountController = {
  // Create discount (Admin only)
  createDiscount: catchAsync(async (req, res) => {
    const discount = await discountService.createDiscount(req.body);

    return sendSuccess(
      res,
      discount,
      "Discount created successfully",
      StatusCodes.CREATED
    );
  }),

  // Get all discounts (Admin only)
  getAllDiscounts: catchAsync(async (req, res) => {
    const result = await discountService.getAllDiscounts(req.query);
    console.log(`Data tu controller discount`, result);

    return sendSuccess(
      res,
      result,
      "Discounts retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get active discounts (Public/User)
  getActiveDiscounts: catchAsync(async (req, res) => {
    const result = await discountService.getActiveDiscounts(req.query);

    return sendSuccess(
      res,
      result,
      "Active discounts retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get discount by ID
  getDiscountById: catchAsync(async (req, res) => {
    const discount = await discountService.getDiscountById(
      req.params.discountId
    );

    return sendSuccess(
      res,
      discount,
      "Discount retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Get discount by code
  getDiscountByCode: catchAsync(async (req, res) => {
    const discount = await discountService.getDiscountByCode(req.params.code);

    return sendSuccess(
      res,
      discount,
      "Discount retrieved successfully",
      StatusCodes.OK
    );
  }),

  // Update discount (Admin only)
  updateDiscount: catchAsync(async (req, res) => {
    const discount = await discountService.updateDiscount(
      req.params.discountId,
      req.body
    );

    return sendSuccess(
      res,
      discount,
      "Discount updated successfully",
      StatusCodes.OK
    );
  }),

  // Delete discount (Admin only)
  deleteDiscount: catchAsync(async (req, res) => {
    const result = await discountService.deleteDiscount(req.params.discountId);

    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  // Apply discount code (validate)
  applyDiscount: catchAsync(async (req, res) => {
    const result = await discountService.applyDiscount(
      req.body.code,
      req.body.orderTotal,
      req.body.productIds
    );

    return sendSuccess(
      res,
      result,
      "Discount applied successfully",
      StatusCodes.OK
    );
  }),

  // Get discount statistics (Admin only)
  getDiscountStatistics: catchAsync(async (req, res) => {
    const stats = await discountService.getDiscountStatistics();

    return sendSuccess(
      res,
      stats,
      "Discount statistics retrieved successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = DiscountController;
