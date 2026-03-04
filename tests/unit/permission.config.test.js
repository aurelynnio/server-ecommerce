/**
 * Unit Tests: Permission Configuration
 * Tests permission builder, validation, expansion, and role mapping
 */
import { describe, it, expect } from 'vitest';

const {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  permission,
  getAllPermissionsList,
  getPermissionsByResource,
  isValidPermission,
  expandManagePermissions,
  getRolePermissions,
} = require('../../src/configs/permission');

describe('Permission Config', () => {
  describe('permission()', () => {
    it('should build resource:action string', () => {
      expect(permission('product', 'create')).toBe('product:create');
      expect(permission('order', 'read')).toBe('order:read');
    });
  });

  describe('RESOURCES & ACTIONS', () => {
    it('should have 17 resources', () => {
      expect(Object.keys(RESOURCES)).toHaveLength(17);
    });

    it('should have 5 actions', () => {
      expect(Object.values(ACTIONS)).toEqual(['create', 'read', 'update', 'delete', 'manage']);
    });
  });

  describe('PERMISSIONS', () => {
    it('should generate 17*5 + 2 special permissions', () => {
      expect(Object.keys(PERMISSIONS).length).toBe(17 * 5 + 2);
    });

    it('should have all resource/action combos', () => {
      expect(PERMISSIONS.PRODUCT_CREATE).toBe('product:create');
      expect(PERMISSIONS.ORDER_READ).toBe('order:read');
      expect(PERMISSIONS.USER_DELETE).toBe('user:delete');
      expect(PERMISSIONS.SHOP_MANAGE).toBe('shop:manage');
    });

    it('should have special permissions', () => {
      expect(PERMISSIONS.ADMIN_ACCESS).toBe('admin:access');
      expect(PERMISSIONS.SELLER_ACCESS).toBe('seller:access');
    });
  });

  describe('getAllPermissionsList()', () => {
    it('should return unique array of permission strings', () => {
      const list = getAllPermissionsList();
      expect(new Set(list).size).toBe(list.length);
      expect(list).toContain('product:create');
      expect(list).toContain('admin:access');
    });
  });

  describe('getPermissionsByResource()', () => {
    it('should group permissions by resource', () => {
      const grouped = getPermissionsByResource();
      expect(grouped.product).toContain('product:create');
      expect(grouped.product).toContain('product:manage');
      expect(grouped.product).toHaveLength(5);
      expect(grouped.order).toHaveLength(5);
    });

    it('should include all resources', () => {
      const grouped = getPermissionsByResource();
      const resources = Object.keys(grouped);
      expect(resources).toContain('product');
      expect(resources).toContain('order');
      expect(resources).toContain('user');
      expect(resources).toContain('admin');
      expect(resources).toContain('seller');
    });
  });

  describe('isValidPermission()', () => {
    it('should accept valid permissions', () => {
      expect(isValidPermission('product:create')).toBe(true);
      expect(isValidPermission('admin:access')).toBe(true);
      expect(isValidPermission('*')).toBe(true);
    });

    it('should reject invalid permissions', () => {
      expect(isValidPermission('fake:permission')).toBe(false);
      expect(isValidPermission('')).toBe(false);
      expect(isValidPermission(null)).toBe(false);
      expect(isValidPermission(undefined)).toBe(false);
      expect(isValidPermission(123)).toBe(false);
    });
  });

  describe('expandManagePermissions()', () => {
    it('should expand :manage to all CRUD actions', () => {
      const expanded = expandManagePermissions(['cart:manage']);
      expect(expanded).toContain('cart:manage');
      expect(expanded).toContain('cart:create');
      expect(expanded).toContain('cart:read');
      expect(expanded).toContain('cart:update');
      expect(expanded).toContain('cart:delete');
      expect(expanded).toHaveLength(5);
    });

    it('should not expand non-manage permissions', () => {
      const expanded = expandManagePermissions(['product:read']);
      expect(expanded).toEqual(['product:read']);
    });

    it('should handle mixed permissions', () => {
      const expanded = expandManagePermissions(['product:read', 'wishlist:manage']);
      expect(expanded).toContain('product:read');
      expect(expanded).toContain('wishlist:create');
      expect(expanded).toContain('wishlist:delete');
    });

    it('should deduplicate', () => {
      const expanded = expandManagePermissions(['cart:manage', 'cart:create']);
      const unique = [...new Set(expanded)];
      expect(expanded.length).toBe(unique.length);
    });
  });

  describe('getRolePermissions()', () => {
    it('should return admin permissions as [*]', () => {
      expect(getRolePermissions('admin')).toEqual(['*']);
    });

    it('should return seller permissions', () => {
      const perms = getRolePermissions('seller');
      expect(perms).toContain('seller:access');
      expect(perms).toContain('product:create');
      expect(perms).toContain('order:read');
    });

    it('should return user permissions', () => {
      const perms = getRolePermissions('user');
      expect(perms).toContain('product:read');
      expect(perms).toContain('cart:manage');
      expect(perms).toContain('order:create');
    });

    it('should handle array of roles', () => {
      const perms = getRolePermissions(['user', 'seller']);
      expect(perms).toContain('product:read');
      expect(perms).toContain('product:create');
      expect(perms).toContain('seller:access');
    });

    it('should deduplicate across roles', () => {
      const perms = getRolePermissions(['user', 'seller']);
      const unique = [...new Set(perms)];
      expect(perms.length).toBe(unique.length);
    });

    it('should return empty for unknown role', () => {
      expect(getRolePermissions('superadmin')).toEqual([]);
    });
  });

  describe('ROLE_PERMISSIONS', () => {
    it('admin should have wildcard', () => {
      expect(ROLE_PERMISSIONS.admin).toEqual(['*']);
    });

    it('seller should not have user/admin management', () => {
      const seller = ROLE_PERMISSIONS.seller;
      expect(seller).not.toContain('user:create');
      expect(seller).not.toContain('user:delete');
      expect(seller).not.toContain('admin:access');
    });

    it('user should not have admin/seller access', () => {
      const user = ROLE_PERMISSIONS.user;
      expect(user).not.toContain('admin:access');
      expect(user).not.toContain('seller:access');
    });
  });
});
