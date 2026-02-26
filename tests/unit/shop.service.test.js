/**
 * Unit Tests: Shop Service Logic
 * Tests shop statistics transforms, status validation, sensitive field stripping,
 * follow/unfollow idempotency, rating distribution defaults
 */
import { describe, it, expect } from "vitest";

describe("ShopService Logic", () => {
  // --- updateShop: strip sensitive fields ---
  describe("stripSensitiveFields", () => {
    const stripSensitiveFields = (updates) => {
      const cleaned = { ...updates };
      delete cleaned.owner;
      delete cleaned.status;
      delete cleaned.rating;
      delete cleaned.metrics;
      return cleaned;
    };

    it("should remove owner field", () => {
      const result = stripSensitiveFields({ name: "Shop", owner: "user123" });
      expect(result.owner).toBeUndefined();
      expect(result.name).toBe("Shop");
    });

    it("should remove status field", () => {
      const result = stripSensitiveFields({ name: "Shop", status: "active" });
      expect(result.status).toBeUndefined();
    });

    it("should remove rating field", () => {
      const result = stripSensitiveFields({ rating: 5, name: "Shop" });
      expect(result.rating).toBeUndefined();
    });

    it("should remove metrics field", () => {
      const result = stripSensitiveFields({ metrics: {}, description: "Hi" });
      expect(result.metrics).toBeUndefined();
    });

    it("should remove all sensitive fields at once", () => {
      const result = stripSensitiveFields({
        name: "Shop",
        description: "A shop",
        owner: "u1",
        status: "active",
        rating: 4.5,
        metrics: { views: 100 },
      });
      expect(result).toEqual({ name: "Shop", description: "A shop" });
    });

    it("should pass through non-sensitive fields unchanged", () => {
      const result = stripSensitiveFields({ name: "New", description: "Desc" });
      expect(result).toEqual({ name: "New", description: "Desc" });
    });
  });

  // --- updateShopStatus: valid statuses ---
  describe("validateShopStatus", () => {
    const VALID_STATUSES = ["pending", "active", "suspended", "closed"];

    const validateStatus = (status) => VALID_STATUSES.includes(status);

    it.each(["pending", "active", "suspended", "closed"])(
      'should accept valid status "%s"',
      (status) => {
        expect(validateStatus(status)).toBe(true);
      },
    );

    it.each(["deleted", "inactive", "open", "ACTIVE", ""])(
      'should reject invalid status "%s"',
      (status) => {
        expect(validateStatus(status)).toBe(false);
      },
    );
  });

  // --- ordersByStatus initialization ---
  describe("initOrdersByStatus", () => {
    const ALL_STATUSES = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
      "returned",
    ];

    const initOrdersByStatus = (rawData) => {
      const statusMap = {};
      ALL_STATUSES.forEach((s) => (statusMap[s] = 0));
      rawData.forEach(({ _id, count }) => {
        statusMap[_id] = count;
      });
      return statusMap;
    };

    it("should initialize all statuses to 0", () => {
      const result = initOrdersByStatus([]);
      ALL_STATUSES.forEach((s) => {
        expect(result[s]).toBe(0);
      });
    });

    it("should merge raw data into defaults", () => {
      const raw = [
        { _id: "pending", count: 5 },
        { _id: "delivered", count: 10 },
      ];
      const result = initOrdersByStatus(raw);
      expect(result.pending).toBe(5);
      expect(result.delivered).toBe(10);
      expect(result.confirmed).toBe(0);
      expect(result.shipping).toBe(0);
      expect(result.cancelled).toBe(0);
      expect(result.returned).toBe(0);
    });

    it("should handle all statuses present in raw data", () => {
      const raw = ALL_STATUSES.map((s, i) => ({ _id: s, count: (i + 1) * 10 }));
      const result = initOrdersByStatus(raw);
      expect(result.pending).toBe(10);
      expect(result.returned).toBe(60);
    });
  });

  // --- last6Months generation ---
  describe("generateLast6Months", () => {
    const generateLast6Months = (today) => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          key: `${d.getMonth() + 1}/${d.getFullYear()}`,
        });
      }
      return months;
    };

    it("should generate 6 months", () => {
      const result = generateLast6Months(new Date(2024, 5, 15)); // June 2024
      expect(result).toHaveLength(6);
    });

    it("should end with current month", () => {
      const today = new Date(2024, 5, 15); // June 2024
      const result = generateLast6Months(today);
      expect(result[5]).toEqual({ month: 6, year: 2024, key: "6/2024" });
    });

    it("should start 5 months before current", () => {
      const today = new Date(2024, 5, 15); // June 2024
      const result = generateLast6Months(today);
      expect(result[0]).toEqual({ month: 1, year: 2024, key: "1/2024" });
    });

    it("should handle year boundary (January)", () => {
      const today = new Date(2024, 1, 10); // Feb 2024
      const result = generateLast6Months(today);
      expect(result[0]).toEqual({ month: 9, year: 2023, key: "9/2023" });
      expect(result[5]).toEqual({ month: 2, year: 2024, key: "2/2024" });
    });

    it("should handle March (spanning back to October)", () => {
      const today = new Date(2024, 2, 1); // March 2024
      const result = generateLast6Months(today);
      expect(result[0]).toEqual({ month: 10, year: 2023, key: "10/2023" });
      expect(result[5]).toEqual({ month: 3, year: 2024, key: "3/2024" });
    });
  });

  // --- chartData merge (revenue + months) ---
  describe("mergeChartData", () => {
    const mergeChartData = (last6Months, rawStats) => {
      const statsMap = {};
      rawStats.forEach((item) => {
        const key = `${item._id.month}/${item._id.year}`;
        statsMap[key] = { revenue: item.revenue, orders: item.orders };
      });

      return last6Months.map((time) => {
        const data = statsMap[time.key] || { revenue: 0, orders: 0 };
        return {
          month: `T${time.month}`,
          revenue: data.revenue,
          orders: data.orders,
        };
      });
    };

    it("should fill missing months with zeros", () => {
      const months = [
        { month: 1, year: 2024, key: "1/2024" },
        { month: 2, year: 2024, key: "2/2024" },
      ];
      const result = mergeChartData(months, []);
      expect(result).toEqual([
        { month: "T1", revenue: 0, orders: 0 },
        { month: "T2", revenue: 0, orders: 0 },
      ]);
    });

    it("should merge raw stats into correct months", () => {
      const months = [
        { month: 1, year: 2024, key: "1/2024" },
        { month: 2, year: 2024, key: "2/2024" },
        { month: 3, year: 2024, key: "3/2024" },
      ];
      const raw = [
        { _id: { month: 1, year: 2024 }, revenue: 5000000, orders: 20 },
        { _id: { month: 3, year: 2024 }, revenue: 8000000, orders: 35 },
      ];
      const result = mergeChartData(months, raw);
      expect(result[0]).toEqual({ month: "T1", revenue: 5000000, orders: 20 });
      expect(result[1]).toEqual({ month: "T2", revenue: 0, orders: 0 });
      expect(result[2]).toEqual({ month: "T3", revenue: 8000000, orders: 35 });
    });
  });

  // --- topProducts transform ---
  describe("transformTopProducts", () => {
    const transformTopProducts = (products) => {
      return products.map((p) => {
        const image = p.variants?.[0]?.images?.[0] || null;
        const price = p.variants?.[0]?.price || p.price?.currentPrice || 0;
        const sold = p.soldCount || 0;
        const revenue = price * sold;

        return {
          _id: p._id,
          name: p.name,
          image,
          sold,
          revenue,
          price,
        };
      });
    };

    it("should extract first variant image", () => {
      const products = [
        {
          _id: "p1",
          name: "Product A",
          variants: [{ images: ["img1.jpg", "img2.jpg"], price: 100 }],
          soldCount: 10,
        },
      ];
      const result = transformTopProducts(products);
      expect(result[0].image).toBe("img1.jpg");
    });

    it("should use null when no variant images", () => {
      const products = [
        { _id: "p1", name: "Product A", variants: [], soldCount: 5 },
      ];
      const result = transformTopProducts(products);
      expect(result[0].image).toBeNull();
    });

    it("should calculate revenue = price * sold", () => {
      const products = [
        {
          _id: "p1",
          name: "A",
          variants: [{ price: 50000, images: [] }],
          soldCount: 20,
        },
      ];
      const result = transformTopProducts(products);
      expect(result[0].revenue).toBe(1000000);
      expect(result[0].sold).toBe(20);
      expect(result[0].price).toBe(50000);
    });

    it("should fallback to price.currentPrice when no variant price", () => {
      const products = [
        {
          _id: "p1",
          name: "A",
          variants: [{ images: [] }],
          price: { currentPrice: 30000 },
          soldCount: 5,
        },
      ];
      const result = transformTopProducts(products);
      expect(result[0].price).toBe(30000);
      expect(result[0].revenue).toBe(150000);
    });

    it("should handle zero soldCount", () => {
      const products = [{ _id: "p1", name: "A", variants: [], soldCount: 0 }];
      const result = transformTopProducts(products);
      expect(result[0].revenue).toBe(0);
      expect(result[0].sold).toBe(0);
    });

    it("should handle missing soldCount", () => {
      const products = [{ _id: "p1", name: "A" }];
      const result = transformTopProducts(products);
      expect(result[0].sold).toBe(0);
      expect(result[0].revenue).toBe(0);
    });
  });

  // --- recentOrders transform ---
  describe("transformRecentOrders", () => {
    const transformRecentOrders = (orders) => {
      return orders.map((order) => ({
        _id: order._id,
        orderNumber:
          order.orderNumber || order._id.toString().slice(-6).toUpperCase(),
        user: order.userId
          ? {
              name: order.userId.username || order.userId.email || "Guest",
              avatar: order.userId.avatar || null,
            }
          : { name: "Guest", avatar: null },
        totalAmount: order.totalAmount || 0,
        status: order.status,
        createdAt: order.createdAt,
      }));
    };

    it("should use orderNumber when available", () => {
      const orders = [
        {
          _id: "abc123def456",
          orderNumber: "ORD-001",
          userId: { username: "john" },
          totalAmount: 100000,
          status: "pending",
        },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].orderNumber).toBe("ORD-001");
    });

    it("should fallback to last 6 chars of _id uppercased", () => {
      const orders = [
        {
          _id: "abc123def456",
          userId: null,
          totalAmount: 0,
          status: "pending",
        },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].orderNumber).toBe("DEF456");
    });

    it("should extract user info from userId", () => {
      const orders = [
        {
          _id: "1",
          userId: {
            username: "john",
            email: "john@example.com",
            avatar: "avatar.jpg",
          },
          totalAmount: 50000,
          status: "delivered",
        },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].user).toEqual({ name: "john", avatar: "avatar.jpg" });
    });

    it("should fallback to email when no username", () => {
      const orders = [
        {
          _id: "1",
          userId: { email: "john@example.com" },
          totalAmount: 50000,
          status: "pending",
        },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].user.name).toBe("john@example.com");
    });

    it("should show Guest when no userId", () => {
      const orders = [
        { _id: "1", userId: null, totalAmount: 0, status: "pending" },
      ];
      const result = transformRecentOrders(orders);
      expect(result[0].user).toEqual({ name: "Guest", avatar: null });
    });

    it("should default totalAmount to 0", () => {
      const orders = [{ _id: "1", userId: null, status: "pending" }];
      const result = transformRecentOrders(orders);
      expect(result[0].totalAmount).toBe(0);
    });
  });

  // --- follow/unfollow idempotency ---
  describe("followShop", () => {
    const isAlreadyFollowing = (followers, userId) => {
      return followers.some((f) => f.toString() === userId.toString());
    };

    it("should detect already following", () => {
      expect(isAlreadyFollowing(["u1", "u2"], "u1")).toBe(true);
    });

    it("should allow new follow", () => {
      expect(isAlreadyFollowing(["u1", "u2"], "u3")).toBe(false);
    });

    it("should handle empty followers", () => {
      expect(isAlreadyFollowing([], "u1")).toBe(false);
    });
  });

  describe("unfollowShop", () => {
    const removeFollower = (followers, userId) => {
      return followers.filter((f) => f.toString() !== userId.toString());
    };

    it("should remove existing follower", () => {
      const result = removeFollower(["u1", "u2", "u3"], "u2");
      expect(result).toEqual(["u1", "u3"]);
    });

    it("should not change array if user not following", () => {
      const result = removeFollower(["u1", "u2"], "u3");
      expect(result).toEqual(["u1", "u2"]);
    });

    it("should handle empty array", () => {
      const result = removeFollower([], "u1");
      expect(result).toEqual([]);
    });
  });

  // --- getRatings default distribution ---
  describe("ratingDistribution", () => {
    const buildRatingDistribution = (rawRatings) => {
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      rawRatings.forEach(({ _id, count }) => {
        if (_id >= 1 && _id <= 5) dist[_id] = count;
      });
      return dist;
    };

    it("should default all ratings to 0", () => {
      const result = buildRatingDistribution([]);
      expect(result).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });

    it("should merge provided ratings", () => {
      const result = buildRatingDistribution([
        { _id: 5, count: 42 },
        { _id: 1, count: 3 },
      ]);
      expect(result[5]).toBe(42);
      expect(result[1]).toBe(3);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(0);
      expect(result[4]).toBe(0);
    });
  });

  // --- slugify for shop name ---
  describe("shopSlug", () => {
    const slugify = (name) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-");

    it("should lowercase and hyphenate", () => {
      expect(slugify("My Cool Shop")).toBe("my-cool-shop");
    });

    it("should remove special characters", () => {
      expect(slugify("Shop @#$ Name!")).toBe("shop-name");
    });

    it("should collapse multiple hyphens", () => {
      expect(slugify("Shop---Name")).toBe("shop-name");
    });

    it("should trim whitespace", () => {
      expect(slugify("  Shop  ")).toBe("shop");
    });
  });
});
