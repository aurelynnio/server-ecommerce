const bannerRepository = require("../repositories/banner.repository");
const { uploadImage } = require("../configs/cloudinary");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");


/**
 * Service handling banner operations
 * Manages CRUD operations for promotional banners
 */
class BannerService {
  /**
   * Create a new banner
   * @param {Object} payload - Banner data
   * @param {string} payload.title - Banner title
   * @param {string} payload.subtitle - Banner subtitle
   * @param {string} [payload.link] - Banner link URL
   * @param {string} [payload.theme] - Banner theme
   * @param {number} [payload.order] - Display order
   * @param {boolean} [payload.isActive=true] - Active status
   * @param {Object} [file] - Image file to upload
   * @returns {Promise<Object>} Created banner object
   */
  async createBanner(payload, file) {
    if (file) {
      const result = await uploadImage(file.buffer, "banners");
      payload.imageUrl = result.secure_url;
    }
    return await bannerRepository.create(payload);
  }

  /**
   * Get banners with pagination and filtering
   * @param {Object} options - Query options
   * @param {number} [options.limit=10] - Items per page
   * @param {number} [options.page=1] - Page number
   * @param {Object} [options.filter={}] - Filter criteria
   * @param {string} [options.filter.search] - Search term for title/subtitle
   * @param {boolean} [options.filter.isActive] - Filter by active status
   * @returns {Promise<Object>} Paginated banner results
   */
  async getBanners({ limit = 10, page = 1, filter = {} }) {
    const total = await bannerRepository.countByFilters(filter);
    const paginationParams = getPaginationParams(page, limit, total);

    const banners = await bannerRepository.findByFilters(filter, paginationParams);

    return buildPaginationResponse(banners, paginationParams);
  }


  /**
   * Get banner by ID
   * @param {string} id - Banner ID
   * @returns {Promise<Object|null>} Banner object or null if not found
   */
  async getBannerById(id) {
    return await bannerRepository.findById(id);
  }

  /**
   * Update banner by ID
   * @param {string} id - Banner ID
   * @param {Object} payload - Update data
   * @param {Object} [file] - New image file to upload
   * @returns {Promise<Object|null>} Updated banner or null if not found
   */
  async updateBanner(id, payload, file) {
    if (file) {
      const result = await uploadImage(file.buffer, "banners");
      payload.imageUrl = result.secure_url;
    }
    return await bannerRepository.updateById(id, payload);
  }

  /**
   * Delete banner by ID
   * @param {string} id - Banner ID
   * @returns {Promise<Object|null>} Delete result or null if not found
   */
  async deleteBanner(id) {
    const result = await bannerRepository.deleteById(id);
    if (!result) return null;
    return { message: "Banner deleted successfully" };
  }
}

module.exports = new BannerService();
