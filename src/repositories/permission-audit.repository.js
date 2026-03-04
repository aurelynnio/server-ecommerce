const PermissionAudit = require('../models/permission-audit.model');
const BaseRepository = require('./base.repository');

class PermissionAuditRepository extends BaseRepository {
  constructor() {
    super(PermissionAudit);
  }

  createAuditLog({ action, adminId, targetUserId, permission }) {
    return this.create({
      action,
      adminId,
      targetUserId,
      permission,
    });
  }

  countWithFilters({ userId, action } = {}) {
    const query = {};
    if (userId) {
      query.targetUserId = userId;
    }
    if (action) {
      query.action = action;
    }

    return this.countByFilter(query);
  }

  findWithFilters({ userId, action } = {}, { skip = 0, limit = 20 } = {}) {
    const query = {};
    if (userId) {
      query.targetUserId = userId;
    }
    if (action) {
      query.action = action;
    }

    return this.findManyByFilter(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'username email')
      .populate('targetUserId', 'username email');
  }
}

module.exports = new PermissionAuditRepository();
