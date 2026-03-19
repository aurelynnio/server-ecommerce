const Notification = require('../repositories/notification.repository');
const User = require('../repositories/user.repository');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { connectRabbitMQ, config_rabbitMQ } = require('../configs/rabbitMQ.config');
const { buildNotificationUpdatePayload } = require('../utils/notification-update.util');

/**
 * Service handling notification operations
 * Manages creating, retrieving, and updating notifications
 */
class NotificationService {
  async initRabbitMQ(clientName = 'publisher') {
    return connectRabbitMQ('notification', { confirm: true, clientName });
  }

  async publishToQueue({
    clientName,
    queueName,
    content,
    headers = {},
    bufferWarningMessage,
    confirmErrorMessage,
    successMessage,
    successMeta = {},
  }) {
    const { channel } = await this.initRabbitMQ(clientName);
    const queueContent = Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content));

    let isBuffered;
    try {
      isBuffered = await channel.sendToQueue(queueName, queueContent, {
        persistent: true,
        contentType: 'application/json',
        headers,
      });
    } catch (error) {
      logger.error(confirmErrorMessage, {
        error: error.message,
        queue: queueName,
        ...successMeta,
      });
      throw error;
    }

    if (!isBuffered) {
      logger.warn(bufferWarningMessage, { queue: queueName });
    }

    logger.info(successMessage, {
      queue: queueName,
      ...successMeta,
    });

    return {
      published: true,
      queue: queueName,
      ...successMeta,
    };
  }

  async publishNotification(payload, routingKey) {
    const { channel, queue } = await this.initRabbitMQ('publisher');
    const content = Buffer.from(JSON.stringify(payload));
    const exchange = config_rabbitMQ.exchange.name;

    if (!routingKey.startsWith('notification.')) {
      logger.warn(`Unexpected notification routing key: ${routingKey}`);
    }

    let isBuffered;
    try {
      isBuffered = await channel.publish(exchange, routingKey, content, {
        persistent: true,
        contentType: 'application/json',
      });
    } catch (error) {
      logger.error('Failed to confirm notification message', {
        error: error.message,
        routingKey,
        userId: payload.userId,
        type: payload.type || 'system',
      });
      throw error;
    }

    if (!isBuffered) {
      logger.warn('RabbitMQ queue buffer is full for notification exchange');
    }

    logger.info('Notification message published', {
      routingKey,
      queue: queue.name,
      userId: payload.userId,
      type: payload.type || 'system',
    });

    return {
      published: true,
      exchange,
      routingKey,
      queue: queue.name,
    };
  }

  async publishNotificationRetry(content, retryCount) {
    const retryQueue = config_rabbitMQ.queues.notification.retryQueue;
    return this.publishToQueue({
      clientName: 'retry-publisher',
      queueName: retryQueue,
      content,
      headers: {
        'x-retry-count': retryCount,
      },
      bufferWarningMessage: 'RabbitMQ queue buffer is full for notification retry queue',
      confirmErrorMessage: 'Failed to confirm notification retry message',
      successMessage: 'Notification message sent to retry queue',
      successMeta: { retryCount },
    });
  }

  async publishNotificationFailed(content, retryCount) {
    const failedQueue = config_rabbitMQ.queues.notification.failedQueue;
    return this.publishToQueue({
      clientName: 'final-failed-publisher',
      queueName: failedQueue,
      content,
      headers: {
        'x-retry-count': retryCount,
        'x-final-failure-reason': 'max_retries_exceeded',
      },
      bufferWarningMessage: 'RabbitMQ queue buffer is full for notification final failed queue',
      confirmErrorMessage: 'Failed to confirm final failed notification message',
      successMessage: 'Notification message moved to final failed queue',
      successMeta: { retryCount },
    });
  }

  /**
   * Create a new notification and emit real-time event
   * @param {Object} data - Notification data
   * @param {string} data.userId - Recipient user ID (ignored if type is promotion)
   * @param {string} [data.type="system"] - Notification type
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {string} [data.orderId] - Related order ID
   * @param {string} [data.actorUserId] - User who triggered the notification
   * @param {string} [data.shopId] - Related shop ID
   * @param {string} [data.link] - Action link
   * @returns {Promise<Object>} Created notification object
   */
  async createNotification({
    userId,
    type = 'system',
    title,
    message,
    orderId = null,
    actorUserId = null,
    shopId = null,
    link = null,
  }) {
    const { getIO } = require('../socket/index');
    const emitBatchNotifications = async (batchItems) => {
      const io = getIO();
      const userIds = batchItems.map((item) => item.insertOne.document.userId);
      const unreadCounts = await Notification.countUnreadByUserIds(userIds);
      const unreadCountMap = new Map(unreadCounts.map((item) => [item._id.toString(), item.count]));

      batchItems.forEach((item) => {
        const userStrId = item.insertOne.document.userId.toString();
        io.to(userStrId).emit('new_notification', {
          _id: new mongoose.Types.ObjectId(),
          ...item.insertOne.document,
        });
        io.to(userStrId).emit('unread_count', unreadCountMap.get(userStrId) || 0);
      });
    };

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
              actorUserId,
              shopId,
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
            await emitBatchNotifications(batch);
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
          await emitBatchNotifications(batch);
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
      actorUserId,
      shopId,
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
    const existingNotification = await Notification.findByIdAndUserId(id, userId);
    if (!existingNotification) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
    }

    const updatePayload = buildNotificationUpdatePayload(existingNotification, data);
    const notification = await Notification.updateByIdAndUserId(id, userId, updatePayload);

    // If update affects read status, emit new count
    if (data.isRead !== undefined && data.isRead !== existingNotification.isRead) {
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
