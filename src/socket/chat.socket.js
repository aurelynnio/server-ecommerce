const { Conversation } = require('../models/conversation.model');
const logger = require('../utils/logger');

/**
 * Chat socket handler for managing conversation rooms
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const chatSocket = (io, socket) => {
  const userId = socket.user.id;

  socket.on('join_conversation', async (conversationId) => {
    try {
      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const isMember = conversation.members.some((memberId) => memberId.toString() === userId);

      if (!isMember) {
        socket.emit('error', {
          message: 'Access denied: You are not a member of this conversation',
        });
        return;
      }

      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);

      logger.info(`🔌 [Chat Socket] User ${userId} joined room ${roomName}`);

      socket.emit('joined_conversation', { conversationId });
    } catch (error) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  socket.on('leave_conversation', (conversationId) => {
    try {
      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      const roomName = `conversation:${conversationId}`;
      socket.leave(roomName);

      logger.info(`🔌 [Chat Socket] User ${userId} left room ${roomName}`);

      socket.emit('left_conversation', { conversationId });
    } catch (error) {
      logger.error('Error leaving conversation:', error);
      socket.emit('error', { message: 'Failed to leave conversation' });
    }
  });
};

module.exports = chatSocket;
