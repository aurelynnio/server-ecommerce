/**
 * Unit Tests: PermissionService
 * Tests pure logic: role normalization, permission resolution, wildcard, negation
 */
import { describe, it, expect } from 'vitest';

const permissionService = require('../../src/services/permission.service');

describe('PermissionService', () => {
  describe('_normalizeRoles()', () => {
    it('should wrap string into array', () => {
      expect(permissionService._normalizeRoles('admin')).toEqual(['admin']);
    });

    it('should return array as-is', () => {
      expect(permissionService._normalizeRoles(['admin', 'user'])).toEqual(['admin', 'user']);
    });

    it('should filter falsy values', () => {
      expect(permissionService._normalizeRoles([null, 'user', ''])).toEqual(['user']);
    });

    it('should return empty array for null/undefined', () => {
      expect(permissionService._normalizeRoles(null)).toEqual([]);
      expect(permissionService._normalizeRoles(undefined)).toEqual([]);
    });
  });

  describe('_getPermissionsForRoles()', () => {
    it('should return admin wildcard', () => {
      expect(permissionService._getPermissionsForRoles('admin')).toContain('*');
    });

    it('should return seller permissions', () => {
      const perms = permissionService._getPermissionsForRoles('seller');
      expect(perms).toContain('product:create');
      expect(perms).toContain('seller:access');
    });

    it('should return empty for unknown role', () => {
      expect(permissionService._getPermissionsForRoles('ghost')).toEqual([]);
    });

    it('should merge multiple roles without duplicates', () => {
      const perms = permissionService._getPermissionsForRoles(['user', 'seller']);
      const unique = [...new Set(perms)];
      expect(perms.length).toBe(unique.length);
      expect(perms).toContain('product:read');
      expect(perms).toContain('product:create');
    });
  });

  describe('getUserPermissions()', () => {
    it('should return empty for null user', () => {
      expect(permissionService.getUserPermissions(null)).toEqual([]);
    });

    it('should return all permissions for admin', () => {
      const perms = permissionService.getUserPermissions({ role: 'admin' });
      expect(perms.length).toBeGreaterThan(50);
      expect(perms).toContain('product:create');
      expect(perms).toContain('admin:access');
    });

    it('should combine role + user permissions', () => {
      const user = {
        role: 'user',
        permissions: ['statistics:read'],
      };
      const perms = permissionService.getUserPermissions(user);
      expect(perms).toContain('product:read');
      expect(perms).toContain('statistics:read');
    });

    it('should handle negative permissions (deny)', () => {
      const user = {
        role: 'user',
        permissions: ['-order:create'],
      };
      const perms = permissionService.getUserPermissions(user);
      expect(perms).not.toContain('order:create');
      expect(perms).toContain('product:read');
    });

    it('should expand manage permissions', () => {
      const user = { role: 'user' };
      const perms = permissionService.getUserPermissions(user);
      // user has cart:manage → should expand to cart:create, cart:read, etc.
      expect(perms).toContain('cart:create');
      expect(perms).toContain('cart:read');
      expect(perms).toContain('cart:update');
      expect(perms).toContain('cart:delete');
    });

    it('should handle roles as array', () => {
      const user = { roles: ['user', 'seller'] };
      const perms = permissionService.getUserPermissions(user);
      expect(perms).toContain('seller:access');
      expect(perms).toContain('cart:manage');
    });

    it('should handle user with no permissions array', () => {
      const user = { role: 'user' };
      const perms = permissionService.getUserPermissions(user);
      expect(perms).toContain('product:read');
    });
  });

  describe('hasPermission()', () => {
    it('should return false for null user', () => {
      expect(permissionService.hasPermission(null, 'product:read')).toBe(false);
    });

    it('should return false for null permission', () => {
      expect(permissionService.hasPermission({ role: 'user' }, null)).toBe(false);
    });

    it('should grant admin any valid permission', () => {
      const admin = { role: 'admin' };
      expect(permissionService.hasPermission(admin, 'product:create')).toBe(true);
      expect(permissionService.hasPermission(admin, 'user:delete')).toBe(true);
      expect(permissionService.hasPermission(admin, 'order:manage')).toBe(true);
    });

    it('should check exact permission', () => {
      const user = { role: 'user' };
      expect(permissionService.hasPermission(user, 'product:read')).toBe(true);
      expect(permissionService.hasPermission(user, 'product:create')).toBe(false);
    });

    it('should allow manage to cover CRUD', () => {
      const user = { role: 'user' };
      // user has cart:manage
      expect(permissionService.hasPermission(user, 'cart:create')).toBe(true);
      expect(permissionService.hasPermission(user, 'cart:delete')).toBe(true);
    });

    it('should respect negative permissions', () => {
      const user = {
        role: 'user',
        permissions: ['-product:read'],
      };
      expect(permissionService.hasPermission(user, 'product:read')).toBe(false);
    });
  });

  describe('hasAnyPermission()', () => {
    it('should return true if any permission matches', () => {
      const user = { role: 'user' };
      expect(permissionService.hasAnyPermission(user, ['product:read', 'user:delete'])).toBe(true);
    });

    it('should return false if none match', () => {
      const user = { role: 'user' };
      expect(permissionService.hasAnyPermission(user, ['user:delete', 'banner:create'])).toBe(
        false,
      );
    });

    it('should return false for null user', () => {
      expect(permissionService.hasAnyPermission(null, ['product:read'])).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      expect(permissionService.hasAnyPermission({ role: 'user' }, [])).toBe(false);
    });
  });

  describe('hasAllPermissions()', () => {
    it('should return true if all match', () => {
      const user = { role: 'user' };
      expect(permissionService.hasAllPermissions(user, ['product:read', 'order:create'])).toBe(
        true,
      );
    });

    it("should return false if any doesn't match", () => {
      const user = { role: 'user' };
      expect(permissionService.hasAllPermissions(user, ['product:read', 'user:delete'])).toBe(
        false,
      );
    });

    it('should return true for admin with any permissions', () => {
      const admin = { role: 'admin' };
      expect(
        permissionService.hasAllPermissions(admin, [
          'user:delete',
          'banner:create',
          'statistics:read',
        ]),
      ).toBe(true);
    });
  });

  describe('getAllPermissions()', () => {
    it('should return all permission strings', () => {
      const all = permissionService.getAllPermissions();
      expect(all.length).toBeGreaterThan(80);
      expect(all).toContain('product:create');
      expect(all).toContain('admin:access');
    });
  });
});
