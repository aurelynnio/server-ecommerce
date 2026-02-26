/**
 * Unit Tests: Joi Validators
 * Tests validation schemas for auth, product, order, cart, voucher, review
 */
import { describe, it, expect } from "vitest";

const {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  changePasswordValidator,
  resetPasswordValidator,
} = require("../../src/validations/auth.validator");

const {
  createProductValidator,
  getProductsQueryValidator,
  searchQueryValidator,
} = require("../../src/validations/product.validator");

const {
  createOrderValidator,
  updateOrderStatusValidator,
} = require("../../src/validations/order.validator");

const {
  addToCartValidator,
  updateCartItemValidator,
} = require("../../src/validations/cart.validator");

const {
  createVoucherValidator,
} = require("../../src/validations/voucher.validator");

const {
  createReviewValidator,
} = require("../../src/validations/review.validator");

describe("Validators", () => {
  /* ========================================
   * AUTH VALIDATORS
   * ======================================== */
  describe("Auth Validators", () => {
    describe("registerValidator", () => {
      it("should accept valid registration", () => {
        const { error } = registerValidator.validate({
          username: "john_doe",
          email: "john@test.com",
          password: "secret123",
        });
        expect(error).toBeUndefined();
      });

      it("should reject short username", () => {
        const { error } = registerValidator.validate({
          username: "ab",
          email: "john@test.com",
          password: "secret123",
        });
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain("username");
      });

      it("should reject invalid email", () => {
        const { error } = registerValidator.validate({
          username: "john",
          email: "not-an-email",
          password: "secret123",
        });
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain("email");
      });

      it("should reject short password", () => {
        const { error } = registerValidator.validate({
          username: "john",
          email: "john@test.com",
          password: "12345",
        });
        expect(error).toBeDefined();
        expect(error.details[0].path).toContain("password");
      });

      it("should reject missing fields", () => {
        const { error } = registerValidator.validate({});
        expect(error).toBeDefined();
      });

      it("should trim whitespace from username", () => {
        const { value } = registerValidator.validate({
          username: "  john  ",
          email: "john@test.com",
          password: "secret123",
        });
        expect(value.username).toBe("john");
      });
    });

    describe("loginValidator", () => {
      it("should accept valid login", () => {
        const { error } = loginValidator.validate({
          email: "john@test.com",
          password: "secret123",
        });
        expect(error).toBeUndefined();
      });

      it("should reject missing email", () => {
        const { error } = loginValidator.validate({
          password: "secret123",
        });
        expect(error).toBeDefined();
      });
    });

    describe("verifyEmailValidator", () => {
      it("should accept valid 6-digit code", () => {
        const { error } = verifyEmailValidator.validate({
          email: "john@test.com",
          code: "123456",
        });
        expect(error).toBeUndefined();
      });

      it("should reject non-numeric code", () => {
        const { error } = verifyEmailValidator.validate({
          email: "john@test.com",
          code: "abc123",
        });
        expect(error).toBeDefined();
      });

      it("should reject wrong-length code", () => {
        const { error } = verifyEmailValidator.validate({
          email: "john@test.com",
          code: "12345",
        });
        expect(error).toBeDefined();
      });
    });

    describe("changePasswordValidator", () => {
      it("should accept valid password change", () => {
        const { error } = changePasswordValidator.validate({
          oldPassword: "old123",
          newPassword: "new456",
        });
        expect(error).toBeUndefined();
      });

      it("should reject same old and new password", () => {
        const { error } = changePasswordValidator.validate({
          oldPassword: "same123",
          newPassword: "same123",
        });
        expect(error).toBeDefined();
      });

      it("should reject short new password", () => {
        const { error } = changePasswordValidator.validate({
          oldPassword: "old123",
          newPassword: "short",
        });
        expect(error).toBeDefined();
      });
    });

    describe("resetPasswordValidator", () => {
      it("should accept valid reset", () => {
        const { error } = resetPasswordValidator.validate({
          email: "john@test.com",
          code: "123456",
          newPassword: "newpass123",
        });
        expect(error).toBeUndefined();
      });
    });
  });

  /* ========================================
   * PRODUCT VALIDATORS
   * ======================================== */
  describe("Product Validators", () => {
    describe("createProductValidator", () => {
      const validProduct = {
        name: "Test Product Name",
        description:
          "This is a valid product description with at least 10 chars",
        category: "507f1f77bcf86cd799439011",
        price: { currentPrice: 100000 },
      };

      it("should accept valid product", () => {
        const { error } = createProductValidator.validate(validProduct);
        expect(error).toBeUndefined();
      });

      it("should reject short name", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          name: "ab",
        });
        expect(error).toBeDefined();
      });

      it("should reject short description", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          description: "short",
        });
        expect(error).toBeDefined();
      });

      it("should reject invalid category id", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          category: "not-an-objectid",
        });
        expect(error).toBeDefined();
      });

      it("should reject negative price", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          price: { currentPrice: -1 },
        });
        expect(error).toBeDefined();
      });

      it("should reject discountPrice >= currentPrice", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          price: { currentPrice: 100000, discountPrice: 150000 },
        });
        expect(error).toBeDefined();
      });

      it("should accept valid variants", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          variants: [{ name: "Red L", price: 100000, stock: 10 }],
        });
        expect(error).toBeUndefined();
      });

      it("should default status to published", () => {
        const { value } = createProductValidator.validate(validProduct);
        expect(value.status).toBe("published");
      });

      it("should accept valid status values", () => {
        for (const status of ["draft", "published", "suspended"]) {
          const { error } = createProductValidator.validate({
            ...validProduct,
            status,
          });
          expect(error).toBeUndefined();
        }
      });

      it("should reject invalid status", () => {
        const { error } = createProductValidator.validate({
          ...validProduct,
          status: "archived",
        });
        expect(error).toBeDefined();
      });
    });

    describe("getProductsQueryValidator", () => {
      it("should accept empty query (defaults)", () => {
        const { error } = getProductsQueryValidator.validate({});
        expect(error).toBeUndefined();
      });

      it("should accept valid filters", () => {
        const { error } = getProductsQueryValidator.validate({
          page: 1,
          limit: 20,
          category: "507f1f77bcf86cd799439011",
          minPrice: 0,
          maxPrice: 500000,
          status: "published",
        });
        expect(error).toBeUndefined();
      });
    });

    describe("searchQueryValidator", () => {
      it("should accept valid search query", () => {
        const { error } = searchQueryValidator.validate({ q: "áo khoác" });
        expect(error).toBeUndefined();
      });

      it("should reject missing query", () => {
        const { error } = searchQueryValidator.validate({});
        expect(error).toBeDefined();
      });

      it("should sanitize MongoDB operators in query", () => {
        const { value } = searchQueryValidator.validate({
          q: "$where.hack",
        });
        // sanitizeMongoOperators removes $ and .
        expect(value.q).not.toContain("$");
        expect(value.q).not.toContain(".");
      });
    });
  });

  /* ========================================
   * ORDER VALIDATORS
   * ======================================== */
  describe("Order Validators", () => {
    describe("createOrderValidator", () => {
      const validOrder = {
        cartItemIds: ["507f1f77bcf86cd799439011"],
        shippingAddress: {
          fullName: "Nguyễn Văn A",
          phone: "0901234567",
          address: "123 Lê Lợi, Quận 1",
          city: "TP.HCM",
        },
        paymentMethod: "cod",
      };

      it("should accept valid order", () => {
        const { error } = createOrderValidator.validate(validOrder);
        expect(error).toBeUndefined();
      });

      it("should reject empty cartItemIds", () => {
        const { error } = createOrderValidator.validate({
          ...validOrder,
          cartItemIds: [],
        });
        expect(error).toBeDefined();
      });

      it("should reject invalid payment method", () => {
        const { error } = createOrderValidator.validate({
          ...validOrder,
          paymentMethod: "bitcoin",
        });
        expect(error).toBeDefined();
      });

      it("should accept vnpay and momo", () => {
        for (const method of ["cod", "vnpay", "momo"]) {
          const { error } = createOrderValidator.validate({
            ...validOrder,
            paymentMethod: method,
          });
          expect(error).toBeUndefined();
        }
      });

      it("should reject short phone number", () => {
        const { error } = createOrderValidator.validate({
          ...validOrder,
          shippingAddress: {
            ...validOrder.shippingAddress,
            phone: "123",
          },
        });
        expect(error).toBeDefined();
      });

      it("should accept optional voucher codes", () => {
        const { error } = createOrderValidator.validate({
          ...validOrder,
          platformVoucher: "SALE20",
          shopVouchers: [
            {
              shopId: "507f1f77bcf86cd799439011",
              code: "SHOPVIP",
            },
          ],
        });
        expect(error).toBeUndefined();
      });
    });

    describe("updateOrderStatusValidator", () => {
      it("should accept valid statuses", () => {
        const validStatuses = [
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
          "returned",
        ];
        for (const status of validStatuses) {
          const { error } = updateOrderStatusValidator.validate({
            status,
          });
          expect(error).toBeUndefined();
        }
      });

      it("should reject invalid status", () => {
        const { error } = updateOrderStatusValidator.validate({
          status: "unknown",
        });
        expect(error).toBeDefined();
      });
    });
  });

  /* ========================================
   * CART VALIDATORS
   * ======================================== */
  describe("Cart Validators", () => {
    describe("addToCartValidator", () => {
      it("should accept valid cart item", () => {
        const { error } = addToCartValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          quantity: 2,
        });
        expect(error).toBeUndefined();
      });

      it("should reject quantity > 99", () => {
        const { error } = addToCartValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          quantity: 100,
        });
        expect(error).toBeDefined();
      });

      it("should reject quantity < 1", () => {
        const { error } = addToCartValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          quantity: 0,
        });
        expect(error).toBeDefined();
      });
    });

    describe("updateCartItemValidator", () => {
      it("should accept valid quantity update", () => {
        const { error } = updateCartItemValidator.validate({ quantity: 5 });
        expect(error).toBeUndefined();
      });

      it("should reject zero quantity", () => {
        const { error } = updateCartItemValidator.validate({ quantity: 0 });
        expect(error).toBeDefined();
      });
    });
  });

  /* ========================================
   * VOUCHER VALIDATORS
   * ======================================== */
  describe("Voucher Validators", () => {
    describe("createVoucherValidator", () => {
      const validVoucher = {
        code: "SALE20",
        name: "Sale 20%",
        type: "percentage",
        value: 20,
        scope: "platform",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      };

      it("should accept valid voucher", () => {
        const { error } = createVoucherValidator.validate(validVoucher);
        expect(error).toBeUndefined();
      });

      it("should reject invalid type", () => {
        const { error } = createVoucherValidator.validate({
          ...validVoucher,
          type: "unknown",
        });
        expect(error).toBeDefined();
      });

      it("should reject endDate before startDate", () => {
        const { error } = createVoucherValidator.validate({
          ...validVoucher,
          startDate: "2026-12-31",
          endDate: "2026-01-01",
        });
        expect(error).toBeDefined();
      });

      it("should require shopId when scope is shop", () => {
        const { error } = createVoucherValidator.validate({
          ...validVoucher,
          scope: "shop",
        });
        expect(error).toBeDefined();
      });

      it("should accept shop voucher with shopId", () => {
        const { error } = createVoucherValidator.validate({
          ...validVoucher,
          scope: "shop",
          shopId: "507f1f77bcf86cd799439011",
        });
        expect(error).toBeUndefined();
      });

      it("should uppercase the code", () => {
        const { value } = createVoucherValidator.validate({
          ...validVoucher,
          code: "sale20",
        });
        expect(value.code).toBe("SALE20");
      });

      it("should accept fixed_amount type", () => {
        const { error } = createVoucherValidator.validate({
          ...validVoucher,
          type: "fixed_amount",
          value: 50000,
        });
        expect(error).toBeUndefined();
      });
    });
  });

  /* ========================================
   * REVIEW VALIDATORS
   * ======================================== */
  describe("Review Validators", () => {
    describe("createReviewValidator", () => {
      it("should accept valid review", () => {
        const { error } = createReviewValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          rating: 5,
          comment: "Great product",
        });
        expect(error).toBeUndefined();
      });

      it("should reject rating > 5", () => {
        const { error } = createReviewValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          rating: 6,
        });
        expect(error).toBeDefined();
      });

      it("should reject rating < 1", () => {
        const { error } = createReviewValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          rating: 0,
        });
        expect(error).toBeDefined();
      });

      it("should escape HTML in comment", () => {
        const { value } = createReviewValidator.validate({
          productId: "507f1f77bcf86cd799439011",
          rating: 4,
          comment: "<script>alert('xss')</script>",
        });
        expect(value.comment).toContain("&lt;script&gt;");
        expect(value.comment).not.toContain("<script>");
      });
    });
  });
});
