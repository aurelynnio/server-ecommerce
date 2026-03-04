const express = require('express');

const router = express.Router();

const chatController = require('../controllers/chat.controller');

const { verifyAccessToken } = require('../middlewares/auth.middleware');

const validate = require('../middlewares/validate.middleware');

const {
  startConversationValidator,
  sendMessageValidator,
} = require('../validations/chat.validator');
// All chat routes require authentication

router.use(verifyAccessToken);

/**
 * @desc    Start or get an existing conversation
 * @access  Private (Authenticated users)
 * @body    { participantId, type? }
 */
router.post('/start', validate(startConversationValidator), chatController.startConversation);

/**
 * @desc    Send a message in a conversation
 * @access  Private (Authenticated users)
 * @body    { conversationId, content, type? }
 */
router.post('/message', validate(sendMessageValidator), chatController.sendMessage);

/**
 * @desc    Get all conversations for current user
 * @access  Private (Authenticated users)
 */
router.get('/conversations', chatController.getMyConversations);

/**
 * @desc    Get all messages in a conversation
 * @access  Private (Authenticated users - participants only)
 * @param   conversationId - Conversation ID
 */
router.get('/messages/:conversationId', chatController.getMessages);

/**
 * @desc    Mark all messages in a conversation as read
 * @access  Private (Authenticated users - participants only)
 * @param   conversationId - Conversation ID
 */
router.put('/conversations/:conversationId/read', chatController.markAsRead);

module.exports = router;
