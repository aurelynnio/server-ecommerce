const { Schema, model, Types } = require('mongoose');

const messageSchema = new Schema(
  {
    conversationId: {
      type: Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: { type: Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'product'],
      default: 'text',
    },
    attachments: [
      {
        url: { type: String, required: true },
        fileName: { type: String, required: true },
        mimeType: { type: String, default: '' },
        size: { type: Number, default: 0 },
        resourceType: { type: String, default: 'raw' },
      },
    ],
    productRef: { type: Types.ObjectId, ref: 'Product', default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'messages' },
);

// Message Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 }); // Loading messages in conversation
messageSchema.index({ conversationId: 1, isRead: 1 }); // Counting unread messages

const conversationSchema = new Schema(
  {
    members: [{ type: Types.ObjectId, ref: 'User' }], // [BuyerId, SellerId]
    shopId: { type: Types.ObjectId, ref: 'Shop' }, // Context: Which shop is this?
    lastMessage: {
      content: String,
      senderId: { type: Types.ObjectId, ref: 'User' },
      createdAt: Date,
      messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'product'],
        default: 'text',
      },
      attachments: [
        {
          url: String,
          fileName: String,
          mimeType: String,
          size: Number,
          resourceType: String,
        },
      ],
    },
    // Optional context: Chatting about a specific product or order
    context: {
      productId: { type: Types.ObjectId, ref: 'Product' },
      orderId: { type: Types.ObjectId, ref: 'Order' },
    },
  },
  { timestamps: true, collection: 'conversations' },
);

conversationSchema.index({ members: 1 });
conversationSchema.index({ shopId: 1 });

const Conversation = model('Conversation', conversationSchema);
const Message = model('Message', messageSchema);

module.exports = { Conversation, Message };
