const Banner = require("../models/banner.model");
const { uploadImage } = require("../configs/cloudinary");

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
    return await Banner.create(payload);
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
    const { search, ...otherFilters } = filter;
    let query = { ...otherFilters };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { subtitle: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const banners = await Banner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Banner.countDocuments(query);

    return {
      banners,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get banner by ID
   * @param {string} id - Banner ID
   * @returns {Promise<Object|null>} Banner object or null if not found
   */
  async getBannerById(id) {
    return await Banner.findById(id);
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
    return await Banner.findByIdAndUpdate(id, payload, { new: true });
  }

  /**
   * Delete banner by ID
   * @param {string} id - Banner ID
   * @returns {Promise<Object|null>} Delete result or null if not found
   */
  async deleteBanner(id) {
    const result = await Banner.findByIdAndDelete(id);
    if (!result) return null;
    return { message: "Banner deleted successfully" };
  }
}

module.exports = new BannerService();
