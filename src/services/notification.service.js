const Notification = require("../models/notification.model");
const { getIO } = require("../socket/index");

/**
 * Service handling notification operations
 * Manages creating, retrieving, and updating notifications
 */
class NotificationService {
  /**
   * Create a new notification and emit real-time event
   * @param {Object} data - Notification data
   * @param {string} data.userId - Recipient user ID
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
      console.error("Socket error:", error.message);
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
    if(!userId) throw new Error("userId is required");
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("orderId", "orderCode totalAmount status"); 

    const total = await Notification.countDocuments({ userId });
    if(total === null) throw new Error("Failed to count total notifications");
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });
    if(unreadCount === null) throw new Error("Failed to count unread notifications");

    return {
      notifications,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
        unreadCount,
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
      }
    );
    if(!result) throw new Error("Failed to mark notifications as read");

    return result;
  }

  /**
   * Clean (delete) all notifications for a user
   * @param {String} userId
   */
  async cleanNotification(userId) {
    if(!userId) throw new Error("userId is required");
    const result = await Notification.deleteMany({ userId });
    if(!result) throw new Error("Failed to clean notifications");
    return result;
  }

  /**
   * Count unread notifications for a user
   * @param {String} userId
   */
  async countUnread(userId) {
    if(!userId) throw new Error("userId is required");
    const count = await Notification.countDocuments({ userId, isRead: false });
    if(count === null) throw new Error("Failed to count unread notifications"); 
    return count;
  }
}

module.exports = new NotificationService();
