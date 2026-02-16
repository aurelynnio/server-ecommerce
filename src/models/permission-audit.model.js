/**
 * Permission Audit Model
 * Stores audit logs for permission changes (grant, revoke, bulk_update)
 */

const { Schema, model } = require('mongoose');

const permissionAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: ['grant', 'revoke', 'bulk_update'],
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    permission: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'permission_audits',
  }
);

// Indexes for efficient querying
permissionAuditSchema.index({ adminId: 1 });
permissionAuditSchema.index({ targetUserId: 1 });
permissionAuditSchema.index({ createdAt: -1 });
permissionAuditSchema.index({ action: 1 });
permissionAuditSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = model('PermissionAudit', permissionAuditSchema);
