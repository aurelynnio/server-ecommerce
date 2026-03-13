const { Schema, model, Types } = require('mongoose');

const notificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['order_status', 'promotion', 'system', 'chat', 'shop_follow'],
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: Types.ObjectId, ref: 'Order' },
    actorUserId: { type: Types.ObjectId, ref: 'User' },
    shopId: { type: Types.ObjectId, ref: 'Shop' },
    link: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true, collection: 'notifications' },
);

// Indexes
notificationSchema.index({ userId: 1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
