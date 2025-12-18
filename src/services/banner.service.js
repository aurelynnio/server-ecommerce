const Banner = require("../models/banner.model");
const { uploadImage } = require("../configs/cloudinary");

class BannerService {
  async createBanner(payload, file) {
    if (file) {
      const result = await uploadImage(file.buffer, "banners");
      payload.imageUrl = result.secure_url;
    }
    return await Banner.create(payload);
  }

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

  async getBannerById(id) {
    return await Banner.findById(id);
  }

  async updateBanner(id, payload, file) {
    if (file) {
      const result = await uploadImage(file.buffer, "banners");
      payload.imageUrl = result.secure_url;
    }
    return await Banner.findByIdAndUpdate(id, payload, { new: true });
  }

  async deleteBanner(id) {
    const result = await Banner.findByIdAndDelete(id);
    if (!result) return null;
    return { message: "Banner deleted successfully" };
  }
}

module.exports = new BannerService();
