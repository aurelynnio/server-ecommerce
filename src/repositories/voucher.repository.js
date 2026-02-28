const Voucher = require("../models/voucher.model");
const BaseRepository = require("./base.repository");

class VoucherRepository extends BaseRepository {
  constructor() {
    super(Voucher);
  }

  findByCode(code) {
    return this.findOneByFilter({ code });
  }

  findByCodeExcludingId(code, voucherId) {
    return this.findOneByFilter({
      code,
      _id: { $ne: voucherId },
    });
  }

  countWithFilters({ scope, isActive, search, shopId } = {}) {
    const query = {};
    if (scope) {
      query.scope = scope;
    }
    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    }
    if (shopId) {
      query.shopId = shopId;
    }
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    return this.countByFilter(query);
  }

  findWithFilters(
    { scope, isActive, search, shopId } = {},
    { skip = 0, limit = 10 } = {},
  ) {
    const query = {};
    if (scope) {
      query.scope = scope;
    }
    if (typeof isActive === "boolean") {
      query.isActive = isActive;
    }
    if (shopId) {
      query.shopId = shopId;
    }
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    return this.findManyByFilter(query)
      .populate("shopId", "name logo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  findByIdWithShop(voucherId) {
    return this.findById(voucherId)
      .populate("shopId", "name logo")
      .lean();
  }

  findActiveByShop(shopId, now = new Date()) {
    return this.findManyByFilter({
      shopId,
      isActive: true,
      endDate: { $gte: now },
    }).lean();
  }

  findActivePlatform(now = new Date()) {
    return this.findManyByFilter({
      scope: "platform",
      isActive: true,
      endDate: { $gte: now },
    }).lean();
  }

  findAvailablePlatform(now = new Date()) {
    return this.findManyByFilter({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      scope: "platform",
      $or: [
        { usageLimit: 0 },
        { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
      ],
    }).lean();
  }

  findAvailableShop(shopId, now = new Date()) {
    return this.findManyByFilter({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      scope: "shop",
      shopId,
      $or: [
        { usageLimit: 0 },
        { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
      ],
    }).lean();
  }

  findActiveByCode(code) {
    return this.findOneByFilter({ code, isActive: true });
  }

  countExpired(now = new Date()) {
    return this.countByFilter({ endDate: { $lt: now } });
  }

  countPlatformVouchers() {
    return this.countByFilter({ scope: "platform" });
  }

  countShopVouchers() {
    return this.countByFilter({ scope: "shop" });
  }

  findMostUsed(limit = 5) {
    return this.findManyByFilter()
      .sort({ usageCount: -1 })
      .limit(limit)
      .select("code name usageCount type value")
      .lean();
  }

  aggregateTotalUsage() {
    return this.aggregateByPipeline([
      {
        $group: {
          _id: null,
          totalUsage: { $sum: "$usageCount" },
        },
      },
    ]);
  }

  countAll() {
    return this.countByFilter();
  }

  countActive() {
    return this.countByFilter({ isActive: true });
  }
}

module.exports = new VoucherRepository();
