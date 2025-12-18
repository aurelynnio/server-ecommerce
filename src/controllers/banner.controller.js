const catchAsync = require("../configs/catchAsync");
const bannerService = require("../services/banner.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

const BannerController = {
  // Create banner
  createBanner: catchAsync(async (req, res) => {
    const banner = await bannerService.createBanner(req.body, req.file);
    return sendSuccess(
      res,
      banner,
      "Banner created successfully",
      StatusCodes.CREATED
    );
  }),

  // Get active banners (Public)
  getBanners: catchAsync(async (req, res) => {
    const { limit, page, ...filter } = req.query;
    const result = await bannerService.getBanners({
      limit: parseInt(limit) || 10,
      page: parseInt(page) || 1,
      filter: { isActive: true, ...filter },
    });
    
    return sendSuccess(res, result, "Get banners successfully", StatusCodes.OK);
  }),
   
  // Get all banners (Admin)
  getAllBannersAdmin: catchAsync(async (req, res) => {
     const { limit, page, ...filter } = req.query;
     const result = await bannerService.getBanners({
       limit: parseInt(limit) || 20,
       page: parseInt(page) || 1,
       filter: filter, 
     });
     
     return sendSuccess(res, result, "Get all banners for admin successfully", StatusCodes.OK);
   }),

  // Get banner by ID
  getBannerById: catchAsync(async (req, res) => {
    const banner = await bannerService.getBannerById(req.params.id);
    if (!banner) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, banner, "Get banner successfully", StatusCodes.OK);
  }),

  // Update banner
  updateBanner: catchAsync(async (req, res) => {
    const banner = await bannerService.updateBanner(req.params.id, req.body, req.file);
    if (!banner) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, banner, "Update banner successfully", StatusCodes.OK);
  }),

  // Delete banner
  deleteBanner: catchAsync(async (req, res) => {
    const result = await bannerService.deleteBanner(req.params.id);
    if (!result) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),
};

module.exports = BannerController;

