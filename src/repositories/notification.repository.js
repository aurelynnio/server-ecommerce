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
      .populate('orderId', 'totalAmount status')
      .populate('actorUserId', 'username avatar')
      .populate('shopId', 'name slug logo');
  }

  countByUserId(userId) {
    return this.countByFilter({ userId });
  }

  countUnreadByUserId(userId) {
    return this.countByFilter({ userId, isRead: false });
  }

  countUnreadByUserIds(userIds) {
    return this.aggregateByPipeline([
      {
        $match: {
          userId: { $in: userIds },
          isRead: false,
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        },
      },
    ]);
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
    return this.findOneByFilter({ _id: id, userId })
      .populate('orderId')
      .populate('actorUserId', 'username avatar')
      .populate('shopId', 'name slug logo');
  }

  updateByIdAndUserId(id, userId, update) {
    return this.findOneAndUpdateByFilter({ _id: id, userId }, update, { new: true });
  }
}

module.exports = new NotificationRepository();
