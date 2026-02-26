/**
 * Unit Tests: Settings Service Logic
 * Tests dot-notation update builder, valid sections, section CRUD
 */
import { describe, it, expect } from "vitest";

describe("SettingsService Logic", () => {
  // --- Dot-notation update builder ---
  describe("buildUpdateData", () => {
    const buildUpdateData = (updates, userId) => {
      const { store, notifications, display, business } = updates;
      const updateData = {};

      if (store) {
        Object.keys(store).forEach((key) => {
          updateData[`store.${key}`] = store[key];
        });
      }

      if (notifications) {
        Object.keys(notifications).forEach((key) => {
          updateData[`notifications.${key}`] = notifications[key];
        });
      }

      if (display) {
        Object.keys(display).forEach((key) => {
          updateData[`display.${key}`] = display[key];
        });
      }

      if (business) {
        Object.keys(business).forEach((key) => {
          updateData[`business.${key}`] = business[key];
        });
      }

      updateData.updatedBy = userId;
      return updateData;
    };

    it("should build store dot-notation keys", () => {
      const result = buildUpdateData(
        { store: { name: "MyStore", currency: "VND" } },
        "admin1",
      );
      expect(result["store.name"]).toBe("MyStore");
      expect(result["store.currency"]).toBe("VND");
      expect(result.updatedBy).toBe("admin1");
    });

    it("should build notifications dot-notation keys", () => {
      const result = buildUpdateData(
        { notifications: { email: true, sms: false } },
        "admin1",
      );
      expect(result["notifications.email"]).toBe(true);
      expect(result["notifications.sms"]).toBe(false);
    });

    it("should build display dot-notation keys", () => {
      const result = buildUpdateData(
        { display: { theme: "dark", language: "vi" } },
        "admin1",
      );
      expect(result["display.theme"]).toBe("dark");
      expect(result["display.language"]).toBe("vi");
    });

    it("should build business dot-notation keys", () => {
      const result = buildUpdateData(
        { business: { taxRate: 0.1, freeShippingThreshold: 500000 } },
        "admin1",
      );
      expect(result["business.taxRate"]).toBe(0.1);
      expect(result["business.freeShippingThreshold"]).toBe(500000);
    });

    it("should handle multiple sections at once", () => {
      const result = buildUpdateData(
        {
          store: { name: "Shop" },
          display: { theme: "light" },
        },
        "admin1",
      );
      expect(result["store.name"]).toBe("Shop");
      expect(result["display.theme"]).toBe("light");
      expect(Object.keys(result)).toHaveLength(3); // 2 keys + updatedBy
    });

    it("should handle empty updates (only updatedBy)", () => {
      const result = buildUpdateData({}, "admin1");
      expect(result).toEqual({ updatedBy: "admin1" });
    });

    it("should handle nested values", () => {
      const result = buildUpdateData(
        { store: { address: { city: "HCM", zip: "70000" } } },
        "admin1",
      );
      expect(result["store.address"]).toEqual({ city: "HCM", zip: "70000" });
    });
  });

  // --- Section dot-notation builder ---
  describe("buildSectionUpdateData", () => {
    const buildSectionUpdate = (section, data, userId) => {
      const updateData = {};
      Object.keys(data).forEach((key) => {
        updateData[`${section}.${key}`] = data[key];
      });
      updateData.updatedBy = userId;
      return updateData;
    };

    it("should prefix all keys with section name", () => {
      const result = buildSectionUpdate(
        "store",
        { name: "Shop", currency: "VND" },
        "admin1",
      );
      expect(result["store.name"]).toBe("Shop");
      expect(result["store.currency"]).toBe("VND");
      expect(result.updatedBy).toBe("admin1");
    });

    it("should work with notifications section", () => {
      const result = buildSectionUpdate(
        "notifications",
        { pushEnabled: true },
        "admin1",
      );
      expect(result["notifications.pushEnabled"]).toBe(true);
    });

    it("should handle empty data", () => {
      const result = buildSectionUpdate("store", {}, "admin1");
      expect(result).toEqual({ updatedBy: "admin1" });
    });
  });

  // --- Valid sections check ---
  describe("validateSection", () => {
    const VALID_SECTIONS = ["store", "notifications", "display", "business"];

    const isValidSection = (section) => VALID_SECTIONS.includes(section);

    it.each(["store", "notifications", "display", "business"])(
      'should accept valid section "%s"',
      (section) => {
        expect(isValidSection(section)).toBe(true);
      },
    );

    it.each(["auth", "users", "payments", "Store", "DISPLAY", ""])(
      'should reject invalid section "%s"',
      (section) => {
        expect(isValidSection(section)).toBe(false);
      },
    );
  });
});
