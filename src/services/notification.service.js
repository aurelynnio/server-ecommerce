const Notification = require('../repositories/notification.repository');
const User = require('../repositories/user.repository');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');

/**
 * Service handling notification operations
 * Manages creating, retrieving, and updating notifications
 */
class NotificationService {
  /**
   * Create a new notification and emit real-time event
   * @param {Object} data - Notification data
   * @param {string} data.userId - Recipient user ID (ignored if type is promotion)
   * @param {string} [data.type="system"] - Notification type
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {string} [data.orderId] - Related order ID
   * @param {string} [data.link] - Action link
   * @returns {Promise<Object>} Created notification object
   */
  async createNotification({
    userId,
    type = 'system',
    title,
    message,
    orderId = null,
    link = null,
  }) {
    const { getIO } = require('../socket/index');

    // Broadcast Logic for Promotion
    // PERFORMANCE FIX: Use cursor with batch processing instead of loading ALL users
    if (type === 'promotion') {
      const BATCH_SIZE = 1000;
      let processedCount = 0;

      // Use cursor to stream users without loading all into memory
      const cursor = User.streamAllUserIds();
      let batch = [];

      for await (const user of cursor) {
        batch.push({
          insertOne: {
            document: {
              userId: user._id,
              type,
              title,
              message,
              orderId,
              link,
              isRead: false,
              createdAt: new Date(),
            },
          },
        });

        if (batch.length >= BATCH_SIZE) {
          await Notification.bulkWriteNotifications(batch);

          // Emit socket notifications for this batch
          try {
            const io = getIO();
            batch.forEach((item) => {
              const userStrId = item.insertOne.document.userId.toString();
              io.to(userStrId).emit('new_notification', {
                _id: new mongoose.Types.ObjectId(),
                ...item.insertOne.document,
              });
            });
          } catch (error) {
            logger.error('Socket broadcast error:', { error: error.message });
          }

          processedCount += batch.length;
          batch = [];
        }
      }

      // Process remaining batch
      if (batch.length > 0) {
        await Notification.bulkWriteNotifications(batch);

        try {
          const io = getIO();
          batch.forEach((item) => {
            const userStrId = item.insertOne.document.userId.toString();
            io.to(userStrId).emit('new_notification', {
              _id: new mongoose.Types.ObjectId(),
              ...item.insertOne.document,
            });
          });
        } catch (error) {
          logger.error('Socket broadcast error:', { error: error.message });
        }

        processedCount += batch.length;
      }

      return { message: `Broadcasted to ${processedCount} users` };
    }

    // Single User Notification
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      orderId,
      link,
    });

    try {
      const io = getIO();
      io.to(userId).emit('new_notification', notification);
      const unreadCount = await this.countUnread(userId);
      io.to(userId).emit('unread_count', unreadCount);
    } catch (error) {
      logger.error('Socket error:', { error: error.message });
    }

    return notification;
  }

  /**
   * Get list of notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @param {number} [options.page=1] - Page number
   * @param {number} [options.limit=10] - Items per page
   * @returns {Promise<Object>} List of notifications with metadata
   * @throws {Error} If userId is missing
   */
  async getListNotification(userId, { page = 1, limit = 10 } = {}) {
    const total = await Notification.countByUserId(userId);
    const paginationParams = getPaginationParams(page, limit, total || 0);

    const notifications = await Notification.findByUserIdWithPagination(userId, paginationParams);

    const unreadCount = await Notification.countUnreadByUserId(userId);

    return {
      ...buildPaginationResponse(notifications, paginationParams),
      metadata: {
        unreadCount: unreadCount || 0,
      },
    };
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   * @throws {Error} If update fails
   */
  async markReadAll(userId) {
    const result = await Notification.markAllReadByUserId(userId);
    // Update real-time count
    try {
      const { getIO } = require('../socket/index');
      const io = getIO();
      io.to(userId).emit('unread_count', 0);
    } catch (_error) {}

    return result;
  }

  /**
   * Clean (delete) all notifications for a user
   * @param {String} userId
   */
  async cleanNotification(userId) {
    const result = await Notification.deleteAllByUserId(userId);

    // Update real-time count
    try {
      const { getIO } = require('../socket/index');
      const io = getIO();
      io.to(userId).emit('unread_count', 0);
    } catch (_error) {}

    return result;
  }

  /**
   * Count unread notifications for a user
   * @param {String} userId
   */
  async countUnread(userId) {
    const count = await Notification.countUnreadByUserId(userId);
    return count || 0;
  }

  /**
   * Get single notification by ID
   * @param {String} id - Notification ID
   * @param {String} userId - Owner ID
   */
  async getNotificationById(id, userId) {
    const notification = await Notification.findByIdAndUserId(id, userId);
    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
    }
    return notification;
  }

  /**
   * Update notification by ID
   * @param {String} id
   * @param {String} userId
   * @param {Object} data
   */
  async updateNotification(id, userId, data) {
    const notification = await Notification.updateByIdAndUserId(id, userId, data);
    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
    }

    // If update affects read status, emit new count
    if (data.isRead !== undefined) {
      try {
        const { getIO } = require('../socket/index');
        const io = getIO();
        const count = await this.countUnread(userId);
        io.to(userId).emit('unread_count', count);
      } catch (_error) {}
    }

    return notification;
  }
}

module.exports = new NotificationService();
