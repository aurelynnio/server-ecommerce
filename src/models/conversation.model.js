const { Schema, model, Types } = require("mongoose");

// Message Schema
const messageSchema = new Schema(
  {
    conversationId: {
      type: Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    attachments: [String], // images/files
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "messages" }
);

// Conversation Schema
const conversationSchema = new Schema(
  {
    members: [{ type: Types.ObjectId, ref: "User" }], // [BuyerId, SellerId]
    shopId: { type: Types.ObjectId, ref: "Shop" }, // Context: Which shop is this?
    lastMessage: {
      content: String,
      senderId: { type: Types.ObjectId, ref: "User" },
      createdAt: Date,
    },
    // Optional context: Chatting about a specific product or order
    context: {
      productId: { type: Types.ObjectId, ref: "Product" },
      orderId: { type: Types.ObjectId, ref: "Order" },
    },
  },
  { timestamps: true, collection: "conversations" }
);

conversationSchema.index({ members: 1 });
conversationSchema.index({ shopId: 1 });

const Conversation = model("Conversation", conversationSchema);
const Message = model("Message", messageSchema);

module.exports = { Conversation, Message };
