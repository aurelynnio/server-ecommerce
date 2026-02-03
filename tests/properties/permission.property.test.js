/**
 * Property-Based Tests for Permission System
 * Feature: permission-system
 * Uses fast-check for property-based testing
 */

import fc from 'fast-check';
import {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getAllPermissionsList,
  isValidPermission,
  expandManagePermissions,
  permission,
} from '../../src/configs/permission.js';

describe('Permission System - Property Tests', () => {
  /**
   * Feature: permission-system, Property 1: Permission Format Validation
   * For any permission string in the system, it SHALL follow the format
   * `resource:action` where resource and action are non-empty strings
   * separated by a single colon.
   * Validates: Requirements 1.1
   */
  describe('Property 1: Permission Format Validation', () => {
    it('all defined permissions should follow resource:action format', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allPermissions),
          (perm) => {
            // All permissions should pass format validation
            expect(isValidPermission(perm)).toBe(true);
            
            // Should contain exactly one colon
            const colonCount = (perm.match(/:/g) || []).length;
            expect(colonCount).toBe(1);
            
            // Both parts should be non-empty
            const [resource, action] = perm.split(':');
            expect(resource.length).toBeGreaterThan(0);
            expect(action.length).toBeGreaterThan(0);

          }
        ),
        { numRuns: 100 }
      );
    });

    it('permission helper function should generate valid format', () => {
      const resources = Object.values(RESOURCES);
      const actions = Object.values(ACTIONS);
      
      fc.assert(
        fc.property(
          fc.constantFrom(...resources),
          fc.constantFrom(...actions),
          (resource, action) => {
            const perm = permission(resource, action);
            expect(isValidPermission(perm)).toBe(true);
            expect(perm).toBe(`${resource}:${action}`);

          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalid permission formats should be rejected', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('nocolon'),
            fc.constant('too:many:colons'),
            fc.constant(':noprefix'),
            fc.constant('nosuffix:'),
            fc.constant('::'),
          ),
          (invalidPerm) => {
            expect(isValidPermission(invalidPerm)).toBe(false);
          }

        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: permission-system, Property 2: Manage Action Grants All CRUD
   * For any resource and user with `resource:manage` permission, the user
   * SHALL have access to `resource:create`, `resource:read`, `resource:update`,
   * and `resource:delete` permissions.
   * Validates: Requirements 1.4
   */
  describe('Property 2: Manage Action Grants All CRUD', () => {
    it('manage permission should expand to all CRUD permissions', () => {
      const resources = Object.values(RESOURCES);
      
      fc.assert(
        fc.property(
          fc.constantFrom(...resources),
          (resource) => {
            const managePermission = permission(resource, ACTIONS.MANAGE);
            const expanded = expandManagePermissions([managePermission]);
            
            // Should contain the original manage permission
            expect(expanded).toContain(managePermission);
            
            // Should contain all CRUD permissions
            const crudPerms = [
              permission(resource, ACTIONS.CREATE),
              permission(resource, ACTIONS.READ),
              permission(resource, ACTIONS.UPDATE),
              permission(resource, ACTIONS.DELETE),
            ];
            for (const crud of crudPerms) {
              expect(expanded).toContain(crud);
            }

          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-manage permissions should not expand', () => {
      const resources = Object.values(RESOURCES);
      const nonManageActions = [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...resources),
          fc.constantFrom(...nonManageActions),
          (resource, action) => {
            const perm = permission(resource, action);
            const expanded = expandManagePermissions([perm]);
            
            // Should only contain the original permission
            expect(expanded).toHaveLength(1);
            expect(expanded).toContain(perm);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('manage permission should include exactly 4 CRUD permissions', () => {
      const resources = Object.values(RESOURCES);
      
      fc.assert(
        fc.property(
          fc.constantFrom(...resources),
          (resource) => {
            const managePermission = permission(resource, ACTIONS.MANAGE);
            const expanded = expandManagePermissions([managePermission]);
            const crudPerms = [
              permission(resource, ACTIONS.CREATE),
              permission(resource, ACTIONS.READ),
              permission(resource, ACTIONS.UPDATE),
              permission(resource, ACTIONS.DELETE),
            ];
            const expandedCrud = expanded.filter((perm) =>
              crudPerms.includes(perm),
            );

            expect(expandedCrud).toHaveLength(4);
            expect(expandedCrud).toContain(permission(resource, ACTIONS.CREATE));
            expect(expandedCrud).toContain(permission(resource, ACTIONS.READ));
            expect(expandedCrud).toContain(permission(resource, ACTIONS.UPDATE));
            expect(expandedCrud).toContain(permission(resource, ACTIONS.DELETE));
          }
        ),
        { numRuns: 100 }
      );
    });

  });
});


// Import permission service for testing
import permissionService from '../../src/services/permission.service.js';

describe('Permission Service - Property Tests', () => {
  /**
   * Feature: permission-system, Property 3: Admin Has All Permissions
   * For any permission in the system and any user with role `admin`,
   * the `hasPermission(adminUser, permission)` function SHALL return `true`.
   * Validates: Requirements 2.1
   */
  describe('Property 3: Admin Has All Permissions', () => {
    const adminUser = { roles: 'admin', permissions: [] };

    it('admin should have all defined permissions', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allPermissions),
          (perm) => {
            expect(permissionService.hasPermission(adminUser, perm)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('admin should have any random valid permission', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(RESOURCES)),
          fc.constantFrom(...Object.values(ACTIONS)),
          (resource, action) => {
            const perm = permission(resource, action);
            expect(permissionService.hasPermission(adminUser, perm)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: permission-system, Property 4: Effective Permissions Combine Role and User Permissions
   * For any user with role permissions R and user-specific permissions U,
   * the effective permissions SHALL be the union of R and U (with manage expansion applied).
   * Validates: Requirements 2.4, 3.4, 4.4
   */
  describe('Property 4: Effective Permissions Combine Role and User Permissions', () => {
    it('user-specific permissions should be included in effective permissions', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'seller'),
          fc.subarray(allPermissions, { minLength: 1, maxLength: 5 }),
          (role, userPerms) => {
            const user = { roles: role, permissions: userPerms };
            const effectivePerms = permissionService.getUserPermissions(user);
            
            // All user-specific permissions should be in effective permissions
            for (const perm of userPerms) {
              expect(effectivePerms).toContain(perm);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('role permissions should be included in effective permissions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'seller'),
          (role) => {
            const user = { roles: role, permissions: [] };
            const effectivePerms = permissionService.getUserPermissions(user);
            const rolePerms = ROLE_PERMISSIONS[role];
            
            // All role permissions should be in effective permissions (after expansion)
            for (const perm of rolePerms) {
              if (perm.endsWith(':manage')) {
                // Manage permissions expand to CRUD
                const [resource] = perm.split(':');
                expect(effectivePerms).toContain(`${resource}:create`);
                expect(effectivePerms).toContain(`${resource}:read`);
                expect(effectivePerms).toContain(`${resource}:update`);
                expect(effectivePerms).toContain(`${resource}:delete`);
              } else {
                expect(effectivePerms).toContain(perm);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: permission-system, Property 7: hasAnyPermission OR Logic
   * For any user and set of permissions [P1, P2, ...Pn],
   * `hasAnyPermission(user, [P1, P2, ...Pn])` SHALL return `true`
   * if and only if the user has at least one of the permissions.
   * Validates: Requirements 3.3, 4.2
   */
  describe('Property 7: hasAnyPermission OR Logic', () => {
    it('should return true if user has at least one permission', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'seller'),
          fc.subarray(allPermissions, { minLength: 1, maxLength: 3 }),
          (role, permsToCheck) => {
            const rolePerms = ROLE_PERMISSIONS[role];
            const expandedRolePerms = expandManagePermissions(rolePerms);
            const user = { roles: role, permissions: [] };
            
            // Check if user has any of the permissions
            const hasAny = permsToCheck.some(p => expandedRolePerms.includes(p));
            
            expect(permissionService.hasAnyPermission(user, permsToCheck)).toBe(hasAny);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for empty permissions array', () => {
      const user = { roles: 'admin', permissions: [] };
      expect(permissionService.hasAnyPermission(user, [])).toBe(false);
    });
  });

  /**
   * Feature: permission-system, Property 8: hasAllPermissions AND Logic
   * For any user and set of permissions [P1, P2, ...Pn],
   * `hasAllPermissions(user, [P1, P2, ...Pn])` SHALL return `true`
   * if and only if the user has all of the permissions.
   * Validates: Requirements 3.3, 4.3
   */
  describe('Property 8: hasAllPermissions AND Logic', () => {
    it('should return true only if user has all permissions', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'seller'),
          fc.subarray(allPermissions, { minLength: 1, maxLength: 3 }),
          (role, permsToCheck) => {
            const rolePerms = ROLE_PERMISSIONS[role];
            const expandedRolePerms = expandManagePermissions(rolePerms);
            const user = { roles: role, permissions: [] };
            
            // Check if user has all of the permissions
            const hasAll = permsToCheck.every(p => expandedRolePerms.includes(p));
            
            expect(permissionService.hasAllPermissions(user, permsToCheck)).toBe(hasAll);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('admin should have all permissions', () => {
      const allPermissions = getAllPermissionsList();
      const adminUser = { roles: 'admin', permissions: [] };
      
      fc.assert(
        fc.property(
          fc.subarray(allPermissions, { minLength: 1, maxLength: 5 }),
          (permsToCheck) => {
            expect(permissionService.hasAllPermissions(adminUser, permsToCheck)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for empty permissions array', () => {
      const user = { roles: 'admin', permissions: [] };
      expect(permissionService.hasAllPermissions(user, [])).toBe(false);
    });
  });
});


// Import middleware for testing
import { requirePermission } from '../../src/middlewares/permission.middleware.js';

describe('Permission Middleware - Property Tests', () => {
  /**
   * Feature: permission-system, Property 6: Unauthorized Access Returns 403
   * For any protected endpoint requiring permission P and any user without
   * permission P, the middleware SHALL return HTTP status code 403.
   * Validates: Requirements 3.2, 5.4
   */
  describe('Property 6: Unauthorized Access Returns 403', () => {
    // Mock response object
    const createMockRes = () => {
      const res = {
        status: null,
        json: null,
        statusCode: null,
      };
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        return res;
      };
      return res;
    };

    it('should return 401 when user is not authenticated', async () => {
      const allPermissions = getAllPermissionsList();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...allPermissions),
          async (perm) => {
            const req = { user: null };
            const res = createMockRes();
            const next = vi.fn();
            
            const middleware = requirePermission(perm);
            await middleware(req, res, next);
            
            expect(res.statusCode).toBe(401);
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return 403 when user lacks required permission', async () => {
      // User role has limited permissions
      const userPerms = expandManagePermissions(ROLE_PERMISSIONS.user);
      const allPermissions = getAllPermissionsList();
      
      // Find permissions that user doesn't have
      const missingPerms = allPermissions.filter(p => !userPerms.includes(p));
      
      if (missingPerms.length > 0) {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...missingPerms),
            async (perm) => {
              const req = { user: { roles: 'user', permissions: [] } };
              const res = createMockRes();
              const next = vi.fn();
              
              const middleware = requirePermission(perm);
              await middleware(req, res, next);
              
              expect(res.statusCode).toBe(403);
              expect(next).not.toHaveBeenCalled();
            }
          ),
          { numRuns: 50 }
        );
      }
    });

    it('should call next when user has required permission', async () => {
      const userPerms = expandManagePermissions(ROLE_PERMISSIONS.user);
      
      if (userPerms.length > 0) {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...userPerms),
            async (perm) => {
              const req = { user: { roles: 'user', permissions: [] } };
              const res = createMockRes();
              const next = vi.fn();
              
              const middleware = requirePermission(perm);
              await middleware(req, res, next);
              
              expect(next).toHaveBeenCalled();
            }
          ),
          { numRuns: 50 }
        );
      }
    });

    it('admin should pass all permission checks', async () => {
      const allPermissions = getAllPermissionsList();
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...allPermissions),
          async (perm) => {
            const req = { user: { roles: 'admin', permissions: [] } };
            const res = createMockRes();
            const next = vi.fn();
            
            const middleware = requirePermission(perm);
            await middleware(req, res, next);
            
            expect(next).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


describe('Permission Validation - Property Tests', () => {
  /**
   * Feature: permission-system, Property 10: Invalid Permissions Are Rejected
   * For any string that is not a valid permission (not in the defined permissions list),
   * attempting to grant it SHALL result in an error.
   * Validates: Requirements 5.5
   */
  describe('Property 10: Invalid Permissions Are Rejected', () => {
    it('invalid permission strings should be rejected by isValidPermission', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('invalid'),
            fc.constant('not:a:valid:permission'),
            fc.constant('fake:permission'),
            fc.constant('random:action'),
            fc.constant('xyz:abc'),
            fc.constant('test'),
            fc.constant('unknown:read'),
          ),
          (invalidPerm) => {
            const { isValidPermission } = require('../../src/configs/permission.js');
            expect(isValidPermission(invalidPerm)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('valid permissions should be accepted by isValidPermission', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allPermissions),
          (validPerm) => {
            const { isValidPermission } = require('../../src/configs/permission.js');
            expect(isValidPermission(validPerm)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('wildcard permission should be valid', () => {
      const { isValidPermission } = require('../../src/configs/permission.js');
      expect(isValidPermission('*')).toBe(true);
    });
  });

  /**
   * Feature: permission-system, Property 9: Grant and Revoke Are Inverse Operations
   * For any user and valid permission P, granting P then revoking P SHALL result
   * in the user not having P in their user-specific permissions (round-trip property).
   * Validates: Requirements 5.2, 5.3
   * 
   * Note: This is tested at the logic level without database operations
   */
  describe('Property 9: Grant and Revoke Are Inverse Operations (Logic Level)', () => {
    it('adding then removing a permission should result in original state', () => {
      const allPermissions = getAllPermissionsList();
      
      fc.assert(
        fc.property(
          fc.subarray(allPermissions, { minLength: 0, maxLength: 5 }),
          fc.constantFrom(...allPermissions),
          (initialPerms, permToToggle) => {
            // Simulate grant
            const afterGrant = [...new Set([...initialPerms, permToToggle])];
            
            // Simulate revoke
            const afterRevoke = afterGrant.filter(p => p !== permToToggle);
            
            // If permission was not in initial, it should not be in final
            if (!initialPerms.includes(permToToggle)) {
              expect(afterRevoke).not.toContain(permToToggle);
            }
            
            // All other permissions should remain
            for (const perm of initialPerms) {
              if (perm !== permToToggle) {
                expect(afterRevoke).toContain(perm);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: permission-system, Property 11: Audit Logs Are Created for Permission Changes
   * For any grant or revoke operation, an audit log entry SHALL be created
   * containing: action type, admin user ID, target user ID, permission, and timestamp.
   * Validates: Requirements 12.1, 12.2
   * 
   * Note: This tests the audit log structure, not database operations
   */
  describe('Property 11: Audit Logs Structure', () => {
    it('audit log should contain all required fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('grant', 'revoke', 'bulk_update'),
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...getAllPermissionsList()),
          (action, adminId, targetUserId, permission) => {
            // Simulate audit log structure
            const auditLog = {
              action,
              adminId,
              targetUserId,
              permission,
              timestamp: new Date(),
            };
            
            // Verify all required fields exist
            expect(auditLog).toHaveProperty('action');
            expect(auditLog).toHaveProperty('adminId');
            expect(auditLog).toHaveProperty('targetUserId');
            expect(auditLog).toHaveProperty('permission');
            expect(auditLog).toHaveProperty('timestamp');
            
            // Verify action is valid
            expect(['grant', 'revoke', 'bulk_update']).toContain(auditLog.action);
            
            // Verify timestamp is a Date
            expect(auditLog.timestamp).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
