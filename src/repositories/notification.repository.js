const Notification = require('../models/notification.model');
const BaseRepository = require('./base.repository');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  bulkWriteNotifications(operations) {
    return this.Model.bulkWrite(operations);
  }

  findByUserIdWithPagination(userId, { skip, limit }) {
    return this.findManyByFilter({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('orderId', 'orderCode totalAmount status');
  }

  countByUserId(userId) {
    return this.countByFilter({ userId });
  }

  countUnreadByUserId(userId) {
    return this.countByFilter({ userId, isRead: false });
  }

  markAllReadByUserId(userId) {
    return this.updateManyByFilter(
      { userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );
  }

  deleteAllByUserId(userId) {
    return this.deleteManyByFilter({ userId });
  }

  findByIdAndUserId(id, userId) {
    return this.findOneByFilter({ _id: id, userId }).populate('orderId');
  }

  updateByIdAndUserId(id, userId, update) {
    return this.findOneAndUpdateByFilter({ _id: id, userId }, update, { new: true });
  }
}

module.exports = new NotificationRepository();
