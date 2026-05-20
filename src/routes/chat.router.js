const express = require('express');

const router = express.Router();

const chatController = require('../controllers/chat.controller');

const { verifyAccessToken } = require('../middlewares/auth.middleware');

const validate = require('../middlewares/validate.middleware');
const upload = require('../configs/upload');

const {
  startConversationValidator,
  sendMessageValidator,
} = require('../validations/chat.validator');
const { createUpload } = upload;
// All chat routes require authentication

router.use(verifyAccessToken);

const chatUpload = createUpload({
  customAllowedMime: [
    'image/',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
  ],
  customMaxFileSize: (Number(process.env.CHAT_UPLOAD_MAX_MB) || 10) * 1024 * 1024,
  customMaxFiles: Number(process.env.CHAT_UPLOAD_MAX_FILES) || 5,
});

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
 * @desc    Send a media/file message in a conversation
 * @access  Private (Authenticated users)
 * @body    multipart/form-data { conversationId, content?, files[] }
 */
router.post('/message/media', chatUpload.array('files'), chatController.sendMediaMessage);

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
