const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

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
    type = "system",
    title,
    message,
    orderId = null,
    link = null,
  }) {
    const { getIO } = require("../socket/index");

    // Broadcast Logic for Promotion
    // PERFORMANCE FIX: Use cursor with batch processing instead of loading ALL users
    if (type === "promotion") {
      const BATCH_SIZE = 1000;
      let processedCount = 0;
      
      // Use cursor to stream users without loading all into memory
      const cursor = User.find({}).select("_id").cursor();
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
            }
          }
        });

        if (batch.length >= BATCH_SIZE) {
          await Notification.bulkWrite(batch);
          
          // Emit socket notifications for this batch
          try {
            const io = getIO();
            batch.forEach(item => {
              const userStrId = item.insertOne.document.userId.toString();
              io.to(userStrId).emit("new_notification", {
                _id: new mongoose.Types.ObjectId(),
                ...item.insertOne.document,
              });
            });
          } catch (error) {
            logger.error("Socket broadcast error:", { error: error.message });
          }

          processedCount += batch.length;
          batch = [];
        }
      }

      // Process remaining batch
      if (batch.length > 0) {
        await Notification.bulkWrite(batch);
        
        try {
          const io = getIO();
          batch.forEach(item => {
            const userStrId = item.insertOne.document.userId.toString();
            io.to(userStrId).emit("new_notification", {
              _id: new mongoose.Types.ObjectId(),
              ...item.insertOne.document,
            });
          });
        } catch (error) {
          logger.error("Socket broadcast error:", { error: error.message });
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
      io.to(userId).emit("new_notification", notification);
      const unreadCount = await this.countUnread(userId);
      io.to(userId).emit("unread_count", unreadCount);
    } catch (error) {
      logger.error("Socket error:", { error: error.message });
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
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("orderId", "orderCode totalAmount status");

    const total = await Notification.countDocuments({ userId });

    // Safety check for counts
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    const totalPages = Math.ceil((total || 0) / limit);
    const currentPage = Number(page);
    const pageSize = Number(limit);

    return {
      data: notifications,
      pagination: {
        currentPage,
        pageSize,
        totalItems: total || 0,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
      },
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
    const result = await Notification.updateMany(
      { userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );
    // Update real-time count
    try {
      const { getIO } = require("../socket/index");
      const io = getIO();
      io.to(userId).emit("unread_count", 0);
    } catch (e) {}

    return result;
  }

  /**
   * Clean (delete) all notifications for a user
   * @param {String} userId
   */
  async cleanNotification(userId) {
    const result = await Notification.deleteMany({ userId });

    // Update real-time count
    try {
      const { getIO } = require("../socket/index");
      const io = getIO();
      io.to(userId).emit("unread_count", 0);
    } catch (e) {}

    return result;
  }

  /**
   * Count unread notifications for a user
   * @param {String} userId
   */
  async countUnread(userId) {
    const count = await Notification.countDocuments({ userId, isRead: false });
    return count || 0;
  }

  /**
   * Get single notification by ID
   * @param {String} id - Notification ID
   * @param {String} userId - Owner ID
   */
  async getNotificationById(id, userId) {
    const notification = await Notification.findOne({
      _id: id,
      userId,
    }).populate("orderId");
    if (!notification) throw new Error("Notification not found");
    return notification;
  }

  /**
   * Update notification by ID
   * @param {String} id
   * @param {String} userId
   * @param {Object} data
   */
  async updateNotification(id, userId, data) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      data,
      { new: true },
    );
    if (!notification) throw new Error("Notification not found");

    // If update affects read status, emit new count
    if (data.isRead !== undefined) {
      try {
        const { getIO } = require("../socket/index");
        const io = getIO();
        const count = await this.countUnread(userId);
        io.to(userId).emit("unread_count", count);
      } catch (e) {}
    }

    return notification;
  }
}

module.exports = new NotificationService();
