const statisticsService = require("../services/statistics.service");
const catchAsync = require("../configs/catchAsync");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess } = require("../shared/res/formatResponse");

const statisticsController = {
  getDashboardStats: catchAsync(async (req, res) => {
    const stats = await statisticsService.getDashboardStats();
    
    return sendSuccess(
      res,
      stats,
      "Get dashboard statistics successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = statisticsController;
