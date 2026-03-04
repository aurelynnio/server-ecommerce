import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';

// Import permission configs and services
const permissionConfig = await import('../../src/configs/permission.js');
const permissionServiceInstance = (await import('../../src/services/permission.service.js'))
  .default;
const permissionMiddleware = await import('../../src/middlewares/permission.middleware.js');

const { ROLE_PERMISSIONS, getAllPermissionsList, isValidPermission } = permissionConfig;

// Service methods from instance
const getUserPermissions = (user) => permissionServiceInstance.getUserPermissions(user);
const hasPermission = (user, perm) => permissionServiceInstance.hasPermission(user, perm);
const hasAnyPermission = (user, perms) => permissionServiceInstance.hasAnyPermission(user, perms);
const hasAllPermissions = (user, perms) => permissionServiceInstance.hasAllPermissions(user, perms);

const { requirePermission, requireAdminAccess, requireSellerAccess } = permissionMiddleware;

// Permission strings for testing
const PERM_PRODUCTS_CREATE = 'product:create';
const PERM_PRODUCTS_UPDATE = 'product:update';
const PERM_USER_DELETE = 'user:delete';

describe('Permission System - Integration Tests', () => {
  describe('Integration Test 1: Login Flow with Permissions', () => {
    it('should return correct permissions for admin user', () => {
      const adminUser = {
        _id: 'admin123',
        roles: 'admin',
        permissions: [],
      };

      const permissions = getUserPermissions(adminUser);
      const allPermissions = getAllPermissionsList();

      // Admin should have all permissions
      expect(permissions).toEqual(expect.arrayContaining(allPermissions));
      expect(permissions.length).toBeGreaterThanOrEqual(allPermissions.length);
    });

    it('should return correct permissions for seller user', () => {
      const sellerUser = {
        _id: 'seller123',
        roles: 'seller',
        permissions: [],
      };

      const permissions = getUserPermissions(sellerUser);
      const sellerRolePermissions = ROLE_PERMISSIONS.seller;

      // Seller should have at least role permissions
      sellerRolePermissions.forEach((perm) => {
        expect(permissions).toContain(perm);
      });
    });

    it('should return correct permissions for regular user', () => {
      const regularUser = {
        _id: 'user123',
        roles: 'user',
        permissions: [],
      };

      const permissions = getUserPermissions(regularUser);
      const userRolePermissions = ROLE_PERMISSIONS.user;

      // User should have at least role permissions
      userRolePermissions.forEach((perm) => {
        expect(permissions).toContain(perm);
      });
    });

    it('should combine role and user-specific permissions', () => {
      const userWithExtraPerms = {
        _id: 'user123',
        roles: 'user',
        permissions: [PERM_PRODUCTS_CREATE, PERM_PRODUCTS_UPDATE],
      };

      const permissions = getUserPermissions(userWithExtraPerms);

      // Should have both role permissions and user-specific permissions
      expect(permissions).toContain(PERM_PRODUCTS_CREATE);
      expect(permissions).toContain(PERM_PRODUCTS_UPDATE);
      ROLE_PERMISSIONS.user.forEach((perm) => {
        expect(permissions).toContain(perm);
      });
    });
  });

  describe('Integration Test 2: Permission Middleware Blocks Unauthorized', () => {
    const createMockReqRes = (user = null) => {
      const req = { user };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      return { req, res, next };
    };

    it('should block unauthenticated users', async () => {
      const { req, res, next } = createMockReqRes(null);
      const middleware = requirePermission(PERM_PRODUCTS_CREATE);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block users without required permission', async () => {
      const user = {
        _id: 'user123',
        roles: 'user',
        permissions: [],
      };
      const { req, res, next } = createMockReqRes(user);
      const middleware = requirePermission(PERM_USER_DELETE);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow admin users with any permission', async () => {
      const user = {
        _id: 'admin123',
        roles: 'admin',
        permissions: [],
      };
      const { req, res, next } = createMockReqRes(user);
      // Admin should have all permissions through getAllPermissions()
      const middleware = requirePermission(PERM_USER_DELETE);

      await middleware(req, res, next);

      // Admin has all permissions via getAllPermissions(), so should pass
      expect(next).toHaveBeenCalled();
    });

    it('should allow users with user-specific permission', async () => {
      const user = {
        _id: 'user123',
        roles: 'user',
        permissions: [PERM_PRODUCTS_CREATE],
      };
      const { req, res, next } = createMockReqRes(user);
      const middleware = requirePermission(PERM_PRODUCTS_CREATE);

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Integration Test 3: Admin Permission Management', () => {
    it('admin should be able to check any permission', () => {
      const adminUser = {
        _id: 'admin123',
        roles: 'admin',
        permissions: [],
      };

      const allPermissions = getAllPermissionsList();

      // Admin should have all permissions
      allPermissions.forEach((perm) => {
        expect(hasPermission(adminUser, perm)).toBe(true);
      });
    });

    it('admin should pass hasAllPermissions for any combination', () => {
      const adminUser = {
        _id: 'admin123',
        roles: 'admin',
        permissions: [],
      };

      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...getAllPermissionsList()), {
            minLength: 1,
            maxLength: 5,
          }),
          (permissions) => {
            return hasAllPermissions(adminUser, permissions) === true;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('admin should pass hasAnyPermission for any combination', () => {
      const adminUser = {
        _id: 'admin123',
        roles: 'admin',
        permissions: [],
      };

      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...getAllPermissionsList()), {
            minLength: 1,
            maxLength: 5,
          }),
          (permissions) => {
            return hasAnyPermission(adminUser, permissions) === true;
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Integration Test 4: Role-Based Access Control', () => {
    it('requireAdminAccess should only allow admin users', () => {
      const createMockReqRes = (user) => ({
        req: { user },
        res: {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        },
        next: vi.fn(),
      });

      // Admin should pass
      const adminSetup = createMockReqRes({ roles: 'admin', permissions: [] });
      requireAdminAccess(adminSetup.req, adminSetup.res, adminSetup.next);
      expect(adminSetup.next).toHaveBeenCalled();

      // Seller should fail
      const sellerSetup = createMockReqRes({ roles: 'seller', permissions: [] });
      requireAdminAccess(sellerSetup.req, sellerSetup.res, sellerSetup.next);
      expect(sellerSetup.res.status).toHaveBeenCalledWith(403);

      // User should fail
      const userSetup = createMockReqRes({ roles: 'user', permissions: [] });
      requireAdminAccess(userSetup.req, userSetup.res, userSetup.next);
      expect(userSetup.res.status).toHaveBeenCalledWith(403);
    });

    it('requireSellerAccess should allow seller and admin users', () => {
      const createMockReqRes = (user) => ({
        req: { user },
        res: {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        },
        next: vi.fn(),
      });

      // Admin should pass
      const adminSetup = createMockReqRes({ roles: 'admin', permissions: [] });
      requireSellerAccess(adminSetup.req, adminSetup.res, adminSetup.next);
      expect(adminSetup.next).toHaveBeenCalled();

      // Seller should pass
      const sellerSetup = createMockReqRes({ roles: 'seller', permissions: [] });
      requireSellerAccess(sellerSetup.req, sellerSetup.res, sellerSetup.next);
      expect(sellerSetup.next).toHaveBeenCalled();

      // User should fail
      const userSetup = createMockReqRes({ roles: 'user', permissions: [] });
      requireSellerAccess(userSetup.req, userSetup.res, userSetup.next);
      expect(userSetup.res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration Test 5: Permission Validation', () => {
    it('all defined permissions should be valid', () => {
      const allPermissions = getAllPermissionsList();

      allPermissions.forEach((perm) => {
        expect(isValidPermission(perm)).toBe(true);
      });
    });

    it('all role permissions should be valid', () => {
      Object.values(ROLE_PERMISSIONS).forEach((rolePerms) => {
        rolePerms.forEach((perm) => {
          expect(isValidPermission(perm)).toBe(true);
        });
      });
    });

    it('random strings should not be valid permissions', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes(':') && s !== '*'),
          (randomString) => {
            return isValidPermission(randomString) === false;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
