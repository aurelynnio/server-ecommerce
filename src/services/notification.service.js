const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");


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
    if (type === "promotion") {
      const users = await User.find({}).select("_id");
      if (users.length > 0) {
        const notificationsData = users.map((user) => ({
          userId: user._id,
          type,
          title,
          message,
          orderId,
          link,
        }));

        await Notification.insertMany(notificationsData);

        try {
          const io = getIO();
          const targetedIds = [];
          users.forEach((user) => {
             const userStrId = user._id.toString();
             targetedIds.push(userStrId);
             io.to(userStrId).emit("new_notification", {
               _id: new mongoose.Types.ObjectId(),
               userId: user._id,
               type,
               title,
               message,
               orderId,
               link,
               createdAt: new Date(),
               isRead: false
             });
          });
          console.log(`[Notification] Broadcast emitted to ${users.length} users. Targets:`, targetedIds);
        } catch (error) {
           console.error("Socket broadcast error:", error.message);
        }
        return { message: `Broadcasted to ${users.length} users` };
      }
      return { message: "No users to broadcast" };
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
      console.log(`[Notification] Emitting single to ${userId}`);
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
    
    // Safety check for counts
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return {
      notifications,
      meta: {
        total: total || 0,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil((total || 0) / limit),
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
      }
    );
     // Update real-time count
     try {
       const { getIO } = require("../socket/index");
       const io = getIO();
       io.to(userId).emit("unread_count", 0);
     } catch(e) {}

    return result;
  }

  /**
   * Clean (delete) all notifications for a user
   * @param {String} userId
   */
  async cleanNotification(userId) {
    if(!userId) throw new Error("userId is required");
    const result = await Notification.deleteMany({ userId });
    
    // Update real-time count
    try {
       const { getIO } = require("../socket/index");
       const io = getIO();
       io.to(userId).emit("unread_count", 0);
    } catch(e) {}
     
    return result;
  }

  /**
   * Count unread notifications for a user
   * @param {String} userId
   */
  async countUnread(userId) {
    if(!userId) throw new Error("userId is required");
    const count = await Notification.countDocuments({ userId, isRead: false });
    return count || 0;
  }

  /**
   * Get single notification by ID
   * @param {String} id - Notification ID
   * @param {String} userId - Owner ID
   */
  async getNotificationById(id, userId) {
     const notification = await Notification.findOne({ _id: id, userId }).populate("orderId");
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
       { new: true }
    );
    if (!notification) throw new Error("Notification not found");
    
    // If update affects read status, emit new count
    if (data.isRead !== undefined) {
         try {
             const { getIO } = require("../socket/index");
             const io = getIO();
             const count = await this.countUnread(userId);
             io.to(userId).emit("unread_count", count);
         } catch(e) {}
    }

    return notification;
  }
}

module.exports = new NotificationService();
