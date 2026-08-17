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
      .populate('shopId', 'name slug logo')
      .lean();
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

  aggregateSummaryByUserId(userId) {
    return this.aggregateByPipeline([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          unreadCount: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          systemCount: { $sum: { $cond: [{ $eq: ['$type', 'system'] }, 1, 0] } },
          promotionCount: { $sum: { $cond: [{ $eq: ['$type', 'promotion'] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          total: [{ count: '$totalCount' }],
          unread: { $cond: ['$unreadCount', [{ count: '$unreadCount' }], []] },
          system: { $cond: ['$systemCount', [{ count: '$systemCount' }], []] },
          promotion: { $cond: ['$promotionCount', [{ count: '$promotionCount' }], []] },
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
      .populate('shopId', 'name slug logo')
      .lean();
  }

  updateByIdAndUserId(id, userId, update) {
    return this.findOneAndUpdateByFilter({ _id: id, userId }, update, { new: true });
  }
}

module.exports = new NotificationRepository();
