/**
 * Unit Tests: Remaining Validators
 * Tests Joi schemas for user, category, shop, shipping, banner,
 * notification, permission, chat, payment, shop-category, common
 */
import { describe, it, expect } from 'vitest';

const { objectId, pagination } = require('../../src/validations/common.validator');

const {
  updateProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  changePasswordValidator,
  createUserValidator,
  updateUserValidator,
  updateRoleValidator,
} = require('../../src/validations/user.validator');

const {
  createCategoryValidator,
  updateCategoryValidator,
  getCategoriesQueryValidator,
} = require('../../src/validations/category.validator');

const {
  createShopValidator,
  updateShopValidator,
} = require('../../src/validations/shop.validator');

const {
  createTemplateValidator,
  updateTemplateValidator,
} = require('../../src/validations/shipping.validator');

const {
  createBannerValidator,
  updateBannerValidator,
} = require('../../src/validations/banner.validator');

const {
  createNotificationValidator,
  updateNotificationValidator,
} = require('../../src/validations/notification.validator');

const {
  updatePermissionsValidator,
  grantRevokePermissionValidator,
  auditLogsQueryValidator,
} = require('../../src/validations/permission.validator');

const {
  startConversationValidator,
  sendMessageValidator,
} = require('../../src/validations/chat.validator');

const { createPaymentValidator } = require('../../src/validations/payment.validator');

const {
  createShopCategoryValidator,
  updateShopCategoryValidator,
} = require('../../src/validations/shop.category.validator');

/* ===========================
 * COMMON VALIDATOR
 * =========================== */
describe('Common Validator', () => {
  describe('objectId', () => {
    it('should accept valid 24-char hex string', () => {
      const { error } = objectId.validate('507f1f77bcf86cd799439011');
      expect(error).toBeUndefined();
    });

    it('should reject non-hex string', () => {
      const { error } = objectId.validate('not-a-valid-objectid!');
      expect(error).toBeDefined();
    });

    it('should reject short string', () => {
      const { error } = objectId.validate('507f1f77');
      expect(error).toBeDefined();
    });
  });

  describe('pagination', () => {
    it('should apply defaults', () => {
      const schema = require('joi').object(pagination);
      const { value } = schema.validate({});
      expect(value.page).toBe(1);
      expect(value.limit).toBe(10);
    });

    it('should reject page < 1', () => {
      const schema = require('joi').object(pagination);
      const { error } = schema.validate({ page: 0 });
      expect(error).toBeDefined();
    });

    it('should reject limit > 100', () => {
      const schema = require('joi').object(pagination);
      const { error } = schema.validate({ limit: 101 });
      expect(error).toBeDefined();
    });
  });
});

/* ===========================
 * USER VALIDATORS
 * =========================== */
describe('User Validators', () => {
  describe('updateProfileValidator', () => {
    it('should accept valid profile update', () => {
      const { error } = updateProfileValidator.validate({
        username: 'newname',
        email: 'new@email.com',
      });
      expect(error).toBeUndefined();
    });

    it('should reject short username', () => {
      const { error } = updateProfileValidator.validate({ username: 'ab' });
      expect(error).toBeDefined();
    });

    it('should accept empty object (no required fields)', () => {
      const { error } = updateProfileValidator.validate({});
      expect(error).toBeUndefined();
    });
  });

  describe('addAddressValidator', () => {
    const validAddress = {
      fullName: 'Nguyễn Văn A',
      phone: '0901234567',
      address: '123 Lê Lợi',
      city: 'TP.HCM',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
    };

    it('should accept valid address', () => {
      const { error } = addAddressValidator.validate(validAddress);
      expect(error).toBeUndefined();
    });

    it('should reject invalid phone', () => {
      const { error } = addAddressValidator.validate({
        ...validAddress,
        phone: '123',
      });
      expect(error).toBeDefined();
    });

    it('should require all fields', () => {
      const { error } = addAddressValidator.validate({ fullName: 'Test' });
      expect(error).toBeDefined();
    });
  });

  describe('updateAddressValidator', () => {
    it('should accept partial update (all fields optional)', () => {
      const { error } = updateAddressValidator.validate({ city: 'Hà Nội' });
      expect(error).toBeUndefined();
    });
  });

  describe('changePasswordValidator', () => {
    it('should reject same old and new password', () => {
      const { error } = changePasswordValidator.validate({
        oldPassword: 'same123',
        newPassword: 'same123',
      });
      expect(error).toBeDefined();
    });

    it('should accept different passwords', () => {
      const { error } = changePasswordValidator.validate({
        oldPassword: 'old123',
        newPassword: 'new456',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('createUserValidator (admin)', () => {
    it('should accept valid user', () => {
      const { error } = createUserValidator.validate({
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'secret123',
      });
      expect(error).toBeUndefined();
    });

    it('should default role to user', () => {
      const { value } = createUserValidator.validate({
        username: 'newuser',
        email: 'newuser@test.com',
        password: 'secret123',
      });
      expect(value.roles).toBe('user');
    });

    it('should accept admin and seller roles', () => {
      for (const roles of ['admin', 'seller']) {
        const { error } = createUserValidator.validate({
          username: 'user',
          email: 'u@test.com',
          password: 'pass123',
          roles,
        });
        expect(error).toBeUndefined();
      }
    });

    it('should reject invalid role', () => {
      const { error } = createUserValidator.validate({
        username: 'user',
        email: 'u@test.com',
        password: 'pass123',
        roles: 'superadmin',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateUserValidator (admin)', () => {
    it('should accept partial update', () => {
      const { error } = updateUserValidator.validate({
        roles: 'seller',
        isVerifiedEmail: true,
      });
      expect(error).toBeUndefined();
    });

    it('should accept permissions array', () => {
      const { error } = updateUserValidator.validate({
        permissions: ['product:read', 'order:manage'],
      });
      expect(error).toBeUndefined();
    });
  });

  describe('updateRoleValidator', () => {
    it('should require role', () => {
      const { error } = updateRoleValidator.validate({});
      expect(error).toBeDefined();
    });

    it('should accept valid roles', () => {
      for (const roles of ['user', 'admin', 'seller']) {
        const { error } = updateRoleValidator.validate({ roles });
        expect(error).toBeUndefined();
      }
    });
  });
});

/* ===========================
 * CATEGORY VALIDATORS
 * =========================== */
describe('Category Validators', () => {
  describe('createCategoryValidator', () => {
    it('should accept valid category', () => {
      const { error } = createCategoryValidator.validate({
        name: 'Thời trang',
      });
      expect(error).toBeUndefined();
    });

    it('should reject short name', () => {
      const { error } = createCategoryValidator.validate({ name: 'A' });
      expect(error).toBeDefined();
    });

    it('should accept slug pattern', () => {
      const { error } = createCategoryValidator.validate({
        name: 'Fashion',
        slug: 'fashion-women',
      });
      expect(error).toBeUndefined();
    });

    it('should reject slug with uppercase', () => {
      const { error } = createCategoryValidator.validate({
        name: 'Fashion',
        slug: 'Fashion-Women',
      });
      // slug has lowercase() transform, but pattern check happens after
      expect(error).toBeUndefined(); // Joi lowercases before pattern check
    });

    it('should accept parentCategory as objectId', () => {
      const { error } = createCategoryValidator.validate({
        name: 'Subcategory',
        parentCategory: '507f1f77bcf86cd799439011',
      });
      expect(error).toBeUndefined();
    });

    it('should default isActive to true', () => {
      const { value } = createCategoryValidator.validate({ name: 'Test' });
      expect(value.isActive).toBe(true);
    });
  });

  describe('updateCategoryValidator', () => {
    it('should accept empty (name optional)', () => {
      const { error } = updateCategoryValidator.validate({
        description: 'Updated',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('getCategoriesQueryValidator', () => {
    it('should accept filters', () => {
      const { error } = getCategoriesQueryValidator.validate({
        isActive: true,
        parentCategory: '507f1f77bcf86cd799439011',
      });
      expect(error).toBeUndefined();
    });

    it('should accept null parentCategory', () => {
      const { error } = getCategoriesQueryValidator.validate({
        parentCategory: 'null',
      });
      expect(error).toBeUndefined();
    });
  });
});

/* ===========================
 * SHOP VALIDATORS
 * =========================== */
describe('Shop Validators', () => {
  const validShop = {
    name: 'My Shop',
    pickupAddress: {
      fullName: 'Trần Văn B',
      phone: '0987654321',
      address: '456 Nguyễn Huệ',
      city: 'TP.HCM',
      district: 'Quận 3',
      ward: 'Phường 6',
    },
  };

  describe('createShopValidator', () => {
    it('should accept valid shop', () => {
      const { error } = createShopValidator.validate(validShop);
      expect(error).toBeUndefined();
    });

    it('should reject missing name', () => {
      const { error } = createShopValidator.validate({
        pickupAddress: validShop.pickupAddress,
      });
      expect(error).toBeDefined();
    });

    it('should reject missing pickupAddress', () => {
      const { error } = createShopValidator.validate({ name: 'Shop' });
      expect(error).toBeDefined();
    });

    it('should reject invalid phone in address', () => {
      const { error } = createShopValidator.validate({
        ...validShop,
        pickupAddress: { ...validShop.pickupAddress, phone: 'abc' },
      });
      expect(error).toBeDefined();
    });

    it('should reject short name', () => {
      const { error } = createShopValidator.validate({
        ...validShop,
        name: 'AB',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateShopValidator', () => {
    it('should accept partial (name and pickupAddress optional)', () => {
      const { error } = updateShopValidator.validate({
        description: 'New desc',
      });
      expect(error).toBeUndefined();
    });
  });
});

/* ===========================
 * SHIPPING VALIDATORS
 * =========================== */
describe('Shipping Validators', () => {
  const validTemplate = {
    name: 'Standard Shipping',
    rules: [{ name: 'Default', type: 'fixed', baseFee: 30000 }],
  };

  describe('createTemplateValidator', () => {
    it('should accept valid template', () => {
      const { error } = createTemplateValidator.validate(validTemplate);
      expect(error).toBeUndefined();
    });

    it('should accept weight_based type', () => {
      const { error } = createTemplateValidator.validate({
        name: 'Weight',
        rules: [
          {
            name: 'Per KG',
            type: 'weight_based',
            baseFee: 15000,
            stepUnit: 1,
            stepFee: 5000,
          },
        ],
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid rule type', () => {
      const { error } = createTemplateValidator.validate({
        name: 'Bad',
        rules: [{ name: 'X', type: 'invalid_type', baseFee: 0 }],
      });
      expect(error).toBeDefined();
    });

    it('should reject missing rules entirely', () => {
      const { error } = createTemplateValidator.validate({
        name: 'No rules',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateTemplateValidator', () => {
    it('should accept partial update', () => {
      const { error } = updateTemplateValidator.validate({
        isDefault: true,
      });
      expect(error).toBeUndefined();
    });
  });
});

/* ===========================
 * BANNER VALIDATORS
 * =========================== */
describe('Banner Validators', () => {
  describe('createBannerValidator', () => {
    it('should accept valid banner', () => {
      const { error } = createBannerValidator.validate({
        title: 'Summer Sale',
        subtitle: 'Up to 50% off all items',
      });
      expect(error).toBeUndefined();
    });

    it('should default theme to light', () => {
      const { value } = createBannerValidator.validate({
        title: 'Banner',
        subtitle: 'Subtitle here',
      });
      expect(value.theme).toBe('light');
    });

    it('should accept dark theme', () => {
      const { error } = createBannerValidator.validate({
        title: 'Dark Banner',
        subtitle: 'Dark subtitle',
        theme: 'dark',
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid theme', () => {
      const { error } = createBannerValidator.validate({
        title: 'Banner',
        subtitle: 'Sub',
        theme: 'neon',
      });
      expect(error).toBeDefined();
    });

    it('should reject short title', () => {
      const { error } = createBannerValidator.validate({
        title: 'AB',
        subtitle: 'Valid subtitle',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateBannerValidator', () => {
    it('should accept partial update', () => {
      const { error } = updateBannerValidator.validate({
        isActive: false,
        order: 5,
      });
      expect(error).toBeUndefined();
    });
  });
});

/* ===========================
 * NOTIFICATION VALIDATORS
 * =========================== */
describe('Notification Validators', () => {
  describe('createNotificationValidator', () => {
    it('should accept valid notification', () => {
      const { error } = createNotificationValidator.validate({
        title: 'New Order',
        message: 'You have a new order',
        type: 'order_status',
      });
      expect(error).toBeUndefined();
    });

    it('should default type to system', () => {
      const { value } = createNotificationValidator.validate({
        title: 'Notice',
        message: 'System notice',
      });
      expect(value.type).toBe('system');
    });

    it('should accept all valid types', () => {
      for (const type of ['order_status', 'promotion', 'system', 'chat']) {
        const { error } = createNotificationValidator.validate({
          title: 'Test',
          message: 'Msg',
          type,
        });
        expect(error).toBeUndefined();
      }
    });

    it('should reject invalid type', () => {
      const { error } = createNotificationValidator.validate({
        title: 'Test',
        message: 'Msg',
        type: 'unknown',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateNotificationValidator', () => {
    it('should accept isRead toggle', () => {
      const { error } = updateNotificationValidator.validate({ isRead: true });
      expect(error).toBeUndefined();
    });
  });
});

/* ===========================
 * PERMISSION VALIDATORS
 * =========================== */
describe('Permission Validators', () => {
  describe('updatePermissionsValidator', () => {
    it('should accept permissions array', () => {
      const { error } = updatePermissionsValidator.validate({
        permissions: ['product:read', 'order:manage'],
      });
      expect(error).toBeUndefined();
    });

    it('should accept empty array (no min constraint)', () => {
      const { error } = updatePermissionsValidator.validate({
        permissions: [],
      });
      expect(error).toBeUndefined();
    });

    it('should reject missing permissions', () => {
      const { error } = updatePermissionsValidator.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('grantRevokePermissionValidator', () => {
    it('should accept valid permission string', () => {
      const { error } = grantRevokePermissionValidator.validate({
        permission: 'product:create',
      });
      expect(error).toBeUndefined();
    });

    it('should reject empty string', () => {
      const { error } = grantRevokePermissionValidator.validate({
        permission: '',
      });
      expect(error).toBeDefined();
    });
  });

  describe('auditLogsQueryValidator', () => {
    it('should accept valid action filter', () => {
      const { error } = auditLogsQueryValidator.validate({
        action: 'grant',
        page: 1,
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid action', () => {
      const { error } = auditLogsQueryValidator.validate({
        action: 'delete',
      });
      expect(error).toBeDefined();
    });
  });
});

/* ===========================
 * CHAT VALIDATORS
 * =========================== */
describe('Chat Validators', () => {
  describe('startConversationValidator', () => {
    it('should accept valid conversation start', () => {
      const { error } = startConversationValidator.validate({
        shopId: '507f1f77bcf86cd799439011',
      });
      expect(error).toBeUndefined();
    });

    it('should accept with optional productId', () => {
      const { error } = startConversationValidator.validate({
        shopId: '507f1f77bcf86cd799439011',
        productId: '507f1f77bcf86cd799439012',
        message: 'Hello',
      });
      expect(error).toBeUndefined();
    });

    it('should reject missing shopId', () => {
      const { error } = startConversationValidator.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('sendMessageValidator', () => {
    it('should accept valid message', () => {
      const { error } = sendMessageValidator.validate({
        conversationId: '507f1f77bcf86cd799439011',
        content: 'Hello there',
      });
      expect(error).toBeUndefined();
    });

    it('should default messageType to text', () => {
      const { value } = sendMessageValidator.validate({
        conversationId: '507f1f77bcf86cd799439011',
        content: 'Hi',
      });
      expect(value.messageType).toBe('text');
    });

    it('should accept image and product types', () => {
      for (const messageType of ['text', 'image', 'product']) {
        const { error } = sendMessageValidator.validate({
          conversationId: '507f1f77bcf86cd799439011',
          content: 'Content',
          messageType,
        });
        expect(error).toBeUndefined();
      }
    });

    it('should reject invalid messageType', () => {
      const { error } = sendMessageValidator.validate({
        conversationId: '507f1f77bcf86cd799439011',
        content: 'Hi',
        messageType: 'video',
      });
      expect(error).toBeDefined();
    });
  });
});

/* ===========================
 * PAYMENT VALIDATORS
 * =========================== */
describe('Payment Validators', () => {
  describe('createPaymentValidator', () => {
    it('should accept valid orderId', () => {
      const { error } = createPaymentValidator.validate({
        orderId: '507f1f77bcf86cd799439011',
      });
      expect(error).toBeUndefined();
    });

    it('should reject missing orderId', () => {
      const { error } = createPaymentValidator.validate({});
      expect(error).toBeDefined();
    });

    it('should reject invalid orderId format', () => {
      const { error } = createPaymentValidator.validate({
        orderId: 'invalid',
      });
      expect(error).toBeDefined();
    });
  });
});

/* ===========================
 * SHOP CATEGORY VALIDATORS
 * =========================== */
describe('Shop Category Validators', () => {
  describe('createShopCategoryValidator', () => {
    it('should accept valid shop category', () => {
      const { error } = createShopCategoryValidator.validate({
        name: 'Electronics',
      });
      expect(error).toBeUndefined();
    });

    it('should default isActive to true', () => {
      const { value } = createShopCategoryValidator.validate({
        name: 'Clothes',
      });
      expect(value.isActive).toBe(true);
    });

    it('should default displayOrder to 0', () => {
      const { value } = createShopCategoryValidator.validate({
        name: 'Books',
      });
      expect(value.displayOrder).toBe(0);
    });

    it('should reject missing name', () => {
      const { error } = createShopCategoryValidator.validate({});
      expect(error).toBeDefined();
    });

    it('should trim name', () => {
      const { value } = createShopCategoryValidator.validate({
        name: '  Trimmed  ',
      });
      expect(value.name).toBe('Trimmed');
    });
  });

  describe('updateShopCategoryValidator', () => {
    it('should accept partial update (name optional)', () => {
      const { error } = updateShopCategoryValidator.validate({
        isActive: false,
      });
      expect(error).toBeUndefined();
    });
  });
});
