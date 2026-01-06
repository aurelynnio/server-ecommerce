const catchAsync = require("../configs/catchAsync");
const bannerService = require("../services/banner.service");
const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");

/**
 * Banner Controller
 * Handles banner CRUD operations for homepage and promotional displays
 */
const BannerController = {
  /**
   * Create a new banner
   * @route POST /api/banners
   * @access Private (Admin only)
   * @body {string} title - Banner title
   * @body {string} [description] - Banner description
   * @body {string} [link] - Banner click link
   * @body {number} [order] - Display order
   * @body {boolean} [isActive] - Active status
   * @files {File} image - Banner image file
   * @returns {Object} Created banner object
   */
  createBanner: catchAsync(async (req, res) => {
    const banner = await bannerService.createBanner(req.body, req.file);
    return sendSuccess(
      res,
      banner,
      "Banner created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Get active banners for public display
   * @route GET /api/banners
   * @access Public
   * @query {number} [limit=10] - Maximum banners to return
   * @query {number} [page=1] - Page number
   * @returns {Object} Active banners with pagination
   */
  getBanners: catchAsync(async (req, res) => {
    const { limit, page, ...filter } = req.query;
    const result = await bannerService.getBanners({
      limit: parseInt(limit) || 10,
      page: parseInt(page) || 1,
      filter: { isActive: true, ...filter },
    });
    
    return sendSuccess(res, result, "Get banners successfully", StatusCodes.OK);
  }),
   
  /**
   * Get all banners for admin management
   * @route GET /api/banners/admin/all
   * @access Private (Admin only)
   * @query {number} [limit=20] - Maximum banners to return
   * @query {number} [page=1] - Page number
   * @returns {Object} All banners with pagination
   */
  getAllBannersAdmin: catchAsync(async (req, res) => {
     const { limit, page, ...filter } = req.query;
     const result = await bannerService.getBanners({
       limit: parseInt(limit) || 20,
       page: parseInt(page) || 1,
       filter: filter, 
     });
     
     return sendSuccess(res, result, "Get all banners for admin successfully", StatusCodes.OK);
   }),

  /**
   * Get banner by ID
   * @route GET /api/banners/:id
   * @access Public
   * @param {string} id - Banner ID
   * @returns {Object} Banner object
   */
  getBannerById: catchAsync(async (req, res) => {
    const banner = await bannerService.getBannerById(req.params.id);
    if (!banner) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, banner, "Get banner successfully", StatusCodes.OK);
  }),

  /**
   * Update a banner
   * @route PUT /api/banners/:id
   * @access Private (Admin only)
   * @param {string} id - Banner ID to update
   * @body {string} [title] - Updated title
   * @body {string} [description] - Updated description
   * @body {string} [link] - Updated link
   * @body {number} [order] - Updated display order
   * @body {boolean} [isActive] - Updated active status
   * @files {File} [image] - New banner image
   * @returns {Object} Updated banner object
   */
  updateBanner: catchAsync(async (req, res) => {
    const banner = await bannerService.updateBanner(req.params.id, req.body, req.file);
    if (!banner) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, banner, "Update banner successfully", StatusCodes.OK);
  }),

  /**
   * Delete a banner
   * @route DELETE /api/banners/:id
   * @access Private (Admin only)
   * @param {string} id - Banner ID to delete
   * @returns {Object} Deletion confirmation
   */
  deleteBanner: catchAsync(async (req, res) => {
    const result = await bannerService.deleteBanner(req.params.id);
    if (!result) {
      return sendFail(res, "Banner not found", StatusCodes.NOT_FOUND);
    }
    
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),
};

module.exports = BannerController;

