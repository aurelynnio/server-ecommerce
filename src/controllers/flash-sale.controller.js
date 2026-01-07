const catchAsync = require("../configs/catchAsync");
const flashSaleService = require("../services/flash-sale.service");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

const FlashSaleController = {
  /**
   * Get active flash sale products
   * @route GET /api/flash-sale
   */
  getActiveFlashSale: catchAsync(async (req, res) => {
    const { page, limit } = req.query;

    const result = await flashSaleService.getActiveFlashSale({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    return sendSuccess(res, result, "Flash sale products retrieved");
  }),

  /**
   * Get flash sale schedule
   * @route GET /api/flash-sale/schedule
   */
  getSchedule: catchAsync(async (req, res) => {
    const schedule = await flashSaleService.getFlashSaleSchedule();
    return sendSuccess(res, schedule, "Flash sale schedule retrieved");
  }),

  /**
   * Get flash sale by time slot
   * @route GET /api/flash-sale/slot/:timeSlot
   */
  getBySlot: catchAsync(async (req, res) => {
    const { timeSlot } = req.params;

    const result = await flashSaleService.getFlashSaleBySlot(timeSlot);
    return sendSuccess(res, result, "Flash sale slot retrieved");
  }),

  /**
   * Add product to flash sale (Seller/Admin)
   * @route POST /api/flash-sale/:productId
   */
  addToFlashSale: catchAsync(async (req, res) => {
    const { productId } = req.params;
    const flashSaleData = req.body;

    // Validate required fields
    if (!flashSaleData.salePrice || !flashSaleData.startTime || !flashSaleData.endTime) {
      return sendFail(
        res,
        "salePrice, startTime, and endTime are required",
        StatusCodes.BAD_REQUEST
      );
    }

    const result = await flashSaleService.addToFlashSale(productId, flashSaleData);
    return sendSuccess(res, result, "Product added to flash sale", StatusCodes.CREATED);
  }),

  /**
   * Remove product from flash sale (Seller/Admin)
   * @route DELETE /api/flash-sale/:productId
   */
  removeFromFlashSale: catchAsync(async (req, res) => {
    const { productId } = req.params;

    const result = await flashSaleService.removeFromFlashSale(productId);
    return sendSuccess(res, result, "Product removed from flash sale");
  }),

  /**
   * Get flash sale statistics (Admin)
   * @route GET /api/flash-sale/stats
   */
  getStats: catchAsync(async (req, res) => {
    const stats = await flashSaleService.getFlashSaleStats();
    return sendSuccess(res, stats, "Flash sale statistics retrieved");
  }),
};

module.exports = FlashSaleController;
