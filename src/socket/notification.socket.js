const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const notificationSocket = (io, socket) => {
  const userId = socket.user.id;
  logger.info(`[Socket] User ${userId} connected and joining room.`);
  socket.join(userId);

  socket.on('get_notifications', async ({ page = 1, limit = 10 } = {}) => {
    try {
      const result = await notificationService.getListNotification(userId, {
        page,
        limit,
      });
      socket.emit('list_notification', result);
    } catch (error) {
      logger.error('Error getting notifications:', error);
      socket.emit('error', { message: 'Failed to get notifications' });
    }
  });

  // Mark all as read
  socket.on('mark_read_all', async () => {
    try {
      await notificationService.markReadAll(userId);
      socket.emit('mark_read_all_success', { success: true });

      const unreadCount = await notificationService.countUnread(userId);
      io.to(userId).emit('unread_count', unreadCount);
    } catch (error) {
      logger.error('Error marking all as read:', error);
      socket.emit('error', { message: 'Failed to mark all as read' });
    }
  });

  // Clean all notifications
  socket.on('clean_notifications', async () => {
    try {
      await notificationService.cleanNotification(userId);
      socket.emit('clean_notifications_success', { success: true });
      io.to(userId).emit('unread_count', 0);
    } catch (error) {
      logger.error('Error cleaning notifications:', error);
      socket.emit('error', { message: 'Failed to clean notifications' });
    }
  });

  // Get unread count
  socket.on('get_unread_count', async () => {
    try {
      const count = await notificationService.countUnread(userId);
      socket.emit('unread_count', count);
    } catch (error) {
      logger.error('Error getting unread count:', error);
      socket.emit('error', { message: 'Failed to get unread count' });
    }
  });
};

module.exports = notificationSocket;
