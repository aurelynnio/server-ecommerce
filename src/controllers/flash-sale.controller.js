const catchAsync = require("../configs/catchAsync");
const flashSaleService = require("../services/flash-sale.service");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

const FlashSaleController = {
  /**
   * Get active flash sale
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Get schedule
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getSchedule: catchAsync(async (req, res) => {
    const schedule = await flashSaleService.getFlashSaleSchedule();
    return sendSuccess(res, schedule, "Flash sale schedule retrieved");
  }),

  /**
   * Get by slot
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getBySlot: catchAsync(async (req, res) => {
    const { timeSlot } = req.params;

    const result = await flashSaleService.getFlashSaleBySlot(timeSlot);
    return sendSuccess(res, result, "Flash sale slot retrieved");
  }),

  /**
   * Add to flash sale
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  addToFlashSale: catchAsync(async (req, res) => {
    const { productId } = req.params;
    const flashSaleData = req.body;

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
   * Remove from flash sale
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  removeFromFlashSale: catchAsync(async (req, res) => {
    const { productId } = req.params;

    const result = await flashSaleService.removeFromFlashSale(productId);
    return sendSuccess(res, result, "Product removed from flash sale");
  }),

  /**
   * Get stats
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  getStats: catchAsync(async (req, res) => {
    const stats = await flashSaleService.getFlashSaleStats();
    return sendSuccess(res, stats, "Flash sale statistics retrieved");
  }),
};

module.exports = FlashSaleController;
