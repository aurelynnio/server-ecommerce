/**
 * Permission Service
 * Handles permission checking, granting, revoking, and audit logging
 */

const User = require('../models/user.model');
const {
  ROLE_PERMISSIONS,
  getAllPermissionsList,
  isValidPermission,
  expandManagePermissions,
} = require('../configs/permission');

class PermissionService {
  /**
   * Get all effective permissions for a user
   * Combines role-based permissions with user-specific permissions
   * @param {Object} user - User document or user object with roles and permissions
   * @returns {string[]} Array of all effective permission strings
   */
  getUserPermissions(user) {
    if (!user) return [];

    const role = user.roles || user.role;
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    const userPermissions = user.permissions || [];

    // Admin has all permissions (wildcard)
    if (rolePermissions.includes('*')) {
      return this.getAllPermissions();
    }

    // Combine role and user-specific permissions
    const combined = new Set([...rolePermissions, ...userPermissions]);

    // Filter out negative permissions (those starting with '-')
    const positivePerms = [...combined].filter(p => !p.startsWith('-'));
    const negativePerms = [...combined]
      .filter(p => p.startsWith('-'))
      .map(p => p.substring(1)); // Remove the '-' prefix

    // Remove negated permissions from positive permissions
    const finalPerms = positivePerms.filter(p => !negativePerms.includes(p));

    // Expand 'manage' permissions to CRUD
    return expandManagePermissions(finalPerms);
  }

  /**
   * Get all available permissions in the system
   * @returns {string[]} Array of all permission strings
   */
  getAllPermissions() {
    return getAllPermissionsList();
  }

  /**
   * Check if user has a specific permission
   * @param {Object} user - User document or user object
   * @param {string} permission - Permission to check
   * @returns {boolean} True if user has the permission
   */
  hasPermission(user, permission) {
    if (!user || !permission) return false;

    const permissions = this.getUserPermissions(user);

    // Check for wildcard (admin)
    if (permissions.includes('*')) return true;

    // Check for exact match
    if (permissions.includes(permission)) return true;

    // Check for manage permission (grants all CRUD)
    const [resource] = permission.split(':');
    if (permissions.includes(`${resource}:manage`)) return true;

    return false;
  }

  /**
   * Check if user has any of the specified permissions (OR logic)
   * @param {Object} user - User document or user object
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} True if user has at least one permission
   */
  hasAnyPermission(user, permissions) {
    if (!user || !permissions || permissions.length === 0) return false;
    return permissions.some(p => this.hasPermission(user, p));
  }

  /**
   * Check if user has all specified permissions (AND logic)
   * @param {Object} user - User document or user object
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} True if user has all permissions
   */
  hasAllPermissions(user, permissions) {
    if (!user || !permissions || permissions.length === 0) return false;
    return permissions.every(p => this.hasPermission(user, p));
  }

  /**
   * Grant a permission to a user
   * @param {string} userId - Target user ID
   * @param {string} permission - Permission to grant
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} Updated user document
   */
  async grantPermission(userId, permission, adminId) {
    // Validate permission exists
    if (!isValidPermission(permission)) {
      throw new Error(`Invalid permission: ${permission}`);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if permission already exists
    if (user.permissions.includes(permission)) {
      throw new Error('Permission already granted');
    }

    // Add permission
    user.permissions.push(permission);
    await user.save();

    // Log audit
    await this.logAudit('grant', adminId, userId, permission);

    return user;
  }

  /**
   * Revoke a permission from a user
   * @param {string} userId - Target user ID
   * @param {string} permission - Permission to revoke
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} Updated user document
   */
  async revokePermission(userId, permission, adminId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if permission exists on user
    const permIndex = user.permissions.indexOf(permission);
    if (permIndex === -1) {
      throw new Error('Permission not found on user');
    }

    // Remove permission
    user.permissions.splice(permIndex, 1);
    await user.save();

    // Log audit
    await this.logAudit('revoke', adminId, userId, permission);

    return user;
  }

  /**
   * Update all permissions for a user
   * @param {string} userId - Target user ID
   * @param {string[]} permissions - New permissions array
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} Updated user document
   */
  async updateUserPermissions(userId, permissions, adminId) {
    // Validate all permissions
    const invalidPerms = permissions.filter(p => !isValidPermission(p) && !p.startsWith('-'));
    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { permissions },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Log bulk update audit
    await this.logBulkUpdate(adminId, userId, permissions);

    return user;
  }

  /**
   * Log a permission change to audit log
   * @param {string} action - 'grant' or 'revoke'
   * @param {string} adminId - Admin user ID
   * @param {string} targetUserId - Target user ID
   * @param {string} permission - Permission that was changed
   */
  async logAudit(action, adminId, targetUserId, permission) {
    try {
      const PermissionAudit = require('../models/permission-audit.model');
      await PermissionAudit.create({
        action,
        adminId,
        targetUserId,
        permission,
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Failed to log permission audit:', error.message);
    }
  }

  /**
   * Log a bulk permission update
   * @param {string} adminId - Admin user ID
   * @param {string} targetUserId - Target user ID
   * @param {string[]} permissions - New permissions array
   */
  async logBulkUpdate(adminId, targetUserId, permissions) {
    try {
      const PermissionAudit = require('../models/permission-audit.model');
      await PermissionAudit.create({
        action: 'bulk_update',
        adminId,
        targetUserId,
        permission: JSON.stringify(permissions),
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log bulk permission update:', error.message);
    }
  }

  /**
   * Get audit logs with pagination and filters
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.userId - Filter by target user ID
   * @param {string} options.action - Filter by action type
   * @returns {Promise<Object>} Paginated audit logs
   */
  async getAuditLogs({ page = 1, limit = 20, userId, action }) {
    try {
      const PermissionAudit = require('../models/permission-audit.model');
      
      const query = {};
      if (userId) query.targetUserId = userId;
      if (action) query.action = action;

      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        PermissionAudit.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .populate('adminId', 'username email')
          .populate('targetUserId', 'username email'),
        PermissionAudit.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const currentPage = parseInt(page);
      
      return {
        data: logs,
        pagination: {
          currentPage,
          pageSize: limit,
          totalItems: total,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
          nextPage: currentPage < totalPages ? currentPage + 1 : null,
          prevPage: currentPage > 1 ? currentPage - 1 : null,
        },
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error.message);
      return { 
        data: [], 
        pagination: { 
          currentPage: page, 
          pageSize: limit, 
          totalItems: 0, 
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: null,
          prevPage: null,
        } 
      };
    }
  }
}

module.exports = new PermissionService();
