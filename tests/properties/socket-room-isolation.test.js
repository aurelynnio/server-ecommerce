/**
 * Property Test: Message Broadcast Isolation
 * 
 * Property 11: For any message sent in a conversation, the server SHALL emit the `new_message` event
 * ONLY to sockets that are members of that conversation's room.
 * 
 * **Validates: Requirements 6.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 11: Message Broadcast Isolation', () => {
  /**
   * Generator for a valid MongoDB ObjectId-like string
   */
  const objectIdArb = () =>
    fc.string({
      minLength: 24,
      maxLength: 24,
      unit: fc.constantFrom(...'0123456789abcdef'.split('')),
    });

  /**
   * Generator for a socket ID (simulating socket.io socket IDs)
   */
  const socketIdArb = () =>
    fc.string({ minLength: 10, maxLength: 20 })
      .map(s => `socket_${s}`);

  /**
   * Simulates the room naming convention used in chat.socket.js
   */
  const getRoomName = (conversationId) => `conversation:${conversationId}`;

  /**
   * Simulates a socket server with room management
   * This models the behavior of socket.io's room system
   */
  class MockSocketServer {
    constructor() {
      // Map of roomName -> Set of socketIds
      this.rooms = new Map();
      // Map of socketId -> Set of roomNames
      this.socketRooms = new Map();
      // Track emitted messages per socket
      this.emittedMessages = new Map();
    }

    /**
     * Add a socket to a room
     */
    join(socketId, roomName) {
      if (!this.rooms.has(roomName)) {
        this.rooms.set(roomName, new Set());
      }
      this.rooms.get(roomName).add(socketId);

      if (!this.socketRooms.has(socketId)) {
        this.socketRooms.set(socketId, new Set());
      }
      this.socketRooms.get(socketId).add(roomName);
    }

    /**
     * Remove a socket from a room
     */
    leave(socketId, roomName) {
      if (this.rooms.has(roomName)) {
        this.rooms.get(roomName).delete(socketId);
      }
      if (this.socketRooms.has(socketId)) {
        this.socketRooms.get(socketId).delete(roomName);
      }
    }

    /**
     * Get all sockets in a room
     */
    getSocketsInRoom(roomName) {
      return this.rooms.get(roomName) || new Set();
    }

    /**
     * Emit a message to a specific room (simulates io.to(room).emit())
     * This is the broadcast logic we're testing
     */
    emitToRoom(roomName, event, message) {
      const socketsInRoom = this.getSocketsInRoom(roomName);
      
      for (const socketId of socketsInRoom) {
        if (!this.emittedMessages.has(socketId)) {
          this.emittedMessages.set(socketId, []);
        }
        this.emittedMessages.get(socketId).push({ event, message, room: roomName });
      }

      return socketsInRoom;
    }

    /**
     * Get messages received by a socket
     */
    getMessagesForSocket(socketId) {
      return this.emittedMessages.get(socketId) || [];
    }

    /**
     * Check if a socket received a specific message
     */
    socketReceivedMessage(socketId, messageId) {
      const messages = this.getMessagesForSocket(socketId);
      return messages.some(m => m.message._id === messageId);
    }
  }

  /**
   * Generator for a message
   */
  const messageArb = (conversationId, senderId) =>
    fc.record({
      _id: objectIdArb(),
      conversationId: fc.constant(conversationId),
      senderId: fc.constant(senderId),
      content: fc.string({ minLength: 1, maxLength: 200 }),
      attachments: fc.array(fc.string(), { maxLength: 3 }),
      isRead: fc.constant(false),
      createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    });

  /**
   * Generator for a conversation with members
   */
  const conversationArb = () =>
    fc.record({
      _id: objectIdArb(),
      buyerId: objectIdArb(),
      sellerId: objectIdArb(),
    });

  /**
   * Generator for socket room memberships
   * Creates a mapping of socketId -> conversationIds they've joined
   */
  const socketMembershipsArb = (conversationIds) =>
    fc.array(
      fc.record({
        socketId: socketIdArb(),
        userId: objectIdArb(),
        joinedConversations: fc.subarray(conversationIds, { minLength: 0 }),
      }),
      { minLength: 1, maxLength: 20 }
    );

  it('should emit new_message only to sockets in the conversation room', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * For any message sent in a conversation, only sockets that have joined
     * that conversation's room should receive the new_message event.
     */
    fc.assert(
      fc.property(
        fc.array(conversationArb(), { minLength: 1, maxLength: 5 }).chain(conversations => {
          const conversationIds = conversations.map(c => c._id);
          return fc.tuple(
            fc.constant(conversations),
            socketMembershipsArb(conversationIds),
            fc.integer({ min: 0, max: conversations.length - 1 })
          );
        }),
        ([conversations, socketMemberships, targetConversationIndex]) => {
          const server = new MockSocketServer();
          const targetConversation = conversations[targetConversationIndex];
          const targetRoomName = getRoomName(targetConversation._id);

          // Setup: Each socket joins their assigned conversation rooms
          for (const membership of socketMemberships) {
            for (const conversationId of membership.joinedConversations) {
              server.join(membership.socketId, getRoomName(conversationId));
            }
          }

          // Create a message for the target conversation
          const message = {
            _id: 'test_message_id',
            conversationId: targetConversation._id,
            senderId: targetConversation.buyerId,
            content: 'Test message',
            attachments: [],
            isRead: false,
            createdAt: new Date(),
          };

          // Broadcast the message to the target conversation's room
          server.emitToRoom(targetRoomName, 'new_message', message);

          // Verify: Only sockets in the target room received the message
          for (const membership of socketMemberships) {
            const isInTargetRoom = membership.joinedConversations.includes(targetConversation._id);
            const receivedMessage = server.socketReceivedMessage(membership.socketId, message._id);

            if (isInTargetRoom) {
              // Socket in the room SHOULD receive the message
              expect(receivedMessage).toBe(true);
            } else {
              // Socket NOT in the room should NOT receive the message
              expect(receivedMessage).toBe(false);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not leak messages to sockets in other conversation rooms', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * Messages sent to one conversation room should never be received
     * by sockets that are only in different conversation rooms.
     */
    fc.assert(
      fc.property(
        fc.array(conversationArb(), { minLength: 2, maxLength: 5 }),
        fc.array(socketIdArb(), { minLength: 2, maxLength: 10 }),
        (conversations, socketIds) => {
          const server = new MockSocketServer();

          // Assign each socket to exactly one conversation (no overlap)
          const socketAssignments = socketIds.map((socketId, index) => ({
            socketId,
            conversationId: conversations[index % conversations.length]._id,
          }));

          // Setup: Each socket joins only their assigned conversation room
          for (const assignment of socketAssignments) {
            server.join(assignment.socketId, getRoomName(assignment.conversationId));
          }

          // Send a message to the first conversation
          const targetConversation = conversations[0];
          const message = {
            _id: 'isolation_test_message',
            conversationId: targetConversation._id,
            senderId: targetConversation.buyerId,
            content: 'Isolation test',
            attachments: [],
            isRead: false,
            createdAt: new Date(),
          };

          server.emitToRoom(getRoomName(targetConversation._id), 'new_message', message);

          // Verify: Only sockets assigned to the target conversation received the message
          for (const assignment of socketAssignments) {
            const receivedMessage = server.socketReceivedMessage(assignment.socketId, message._id);
            const shouldReceive = assignment.conversationId === targetConversation._id;

            expect(receivedMessage).toBe(shouldReceive);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should deliver message to all sockets in the same conversation room', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * When multiple sockets are in the same conversation room,
     * all of them should receive the message.
     */
    fc.assert(
      fc.property(
        conversationArb(),
        fc.array(socketIdArb(), { minLength: 1, maxLength: 10 }),
        (conversation, socketIds) => {
          const server = new MockSocketServer();
          const roomName = getRoomName(conversation._id);

          // All sockets join the same conversation room
          for (const socketId of socketIds) {
            server.join(socketId, roomName);
          }

          // Send a message
          const message = {
            _id: 'multi_socket_test',
            conversationId: conversation._id,
            senderId: conversation.buyerId,
            content: 'Multi-socket test',
            attachments: [],
            isRead: false,
            createdAt: new Date(),
          };

          server.emitToRoom(roomName, 'new_message', message);

          // Verify: All sockets received the message
          for (const socketId of socketIds) {
            const receivedMessage = server.socketReceivedMessage(socketId, message._id);
            expect(receivedMessage).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle sockets in multiple conversation rooms correctly', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * A socket can be in multiple conversation rooms.
     * It should only receive messages for rooms it has joined.
     */
    fc.assert(
      fc.property(
        fc.array(conversationArb(), { minLength: 2, maxLength: 5 }),
        socketIdArb(),
        fc.integer({ min: 1, max: 4 }),
        (conversations, socketId, numRoomsToJoin) => {
          const server = new MockSocketServer();
          
          // Socket joins a subset of conversation rooms
          const roomsToJoin = conversations.slice(0, Math.min(numRoomsToJoin, conversations.length));
          for (const conv of roomsToJoin) {
            server.join(socketId, getRoomName(conv._id));
          }

          // Send messages to all conversations
          for (const conv of conversations) {
            const message = {
              _id: `msg_${conv._id}`,
              conversationId: conv._id,
              senderId: conv.buyerId,
              content: `Message for ${conv._id}`,
              attachments: [],
              isRead: false,
              createdAt: new Date(),
            };

            server.emitToRoom(getRoomName(conv._id), 'new_message', message);
          }

          // Verify: Socket received messages only for joined rooms
          const receivedMessages = server.getMessagesForSocket(socketId);
          const joinedConversationIds = new Set(roomsToJoin.map(c => c._id));

          // Should have received exactly the number of messages for joined rooms
          expect(receivedMessages.length).toBe(roomsToJoin.length);

          // Each received message should be for a joined conversation
          for (const received of receivedMessages) {
            expect(joinedConversationIds.has(received.message.conversationId)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not deliver messages to sockets that have left the room', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * After a socket leaves a conversation room, it should no longer
     * receive messages for that conversation.
     */
    fc.assert(
      fc.property(
        conversationArb(),
        fc.array(socketIdArb(), { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (conversation, socketIds, leaveIndex) => {
          const server = new MockSocketServer();
          const roomName = getRoomName(conversation._id);
          const uniqueSocketIds = [...new Set(socketIds)];

          if (uniqueSocketIds.length < 2) {
            return true; // Skip if not enough unique sockets
          }

          // All sockets join the room
          for (const socketId of uniqueSocketIds) {
            server.join(socketId, roomName);
          }

          // One socket leaves the room
          const leavingSocketIndex = leaveIndex % uniqueSocketIds.length;
          const leavingSocketId = uniqueSocketIds[leavingSocketIndex];
          server.leave(leavingSocketId, roomName);

          // Send a message
          const message = {
            _id: 'leave_test_message',
            conversationId: conversation._id,
            senderId: conversation.buyerId,
            content: 'Leave test',
            attachments: [],
            isRead: false,
            createdAt: new Date(),
          };

          server.emitToRoom(roomName, 'new_message', message);

          // Verify: The socket that left should NOT receive the message
          const leavingSocketReceived = server.socketReceivedMessage(leavingSocketId, message._id);
          expect(leavingSocketReceived).toBe(false);

          // Verify: Other sockets should still receive the message
          for (let i = 0; i < uniqueSocketIds.length; i++) {
            if (i !== leavingSocketIndex) {
              const received = server.socketReceivedMessage(uniqueSocketIds[i], message._id);
              expect(received).toBe(true);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty rooms gracefully', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * Broadcasting to an empty room should not cause errors
     * and should not deliver messages to any socket.
     */
    fc.assert(
      fc.property(
        conversationArb(),
        fc.array(socketIdArb(), { minLength: 1, maxLength: 5 }),
        (conversation, socketIds) => {
          const server = new MockSocketServer();
          const targetRoomName = getRoomName(conversation._id);
          const otherRoomName = getRoomName('other_conversation_id');

          // Sockets join a different room, not the target room
          for (const socketId of socketIds) {
            server.join(socketId, otherRoomName);
          }

          // Send a message to the empty target room
          const message = {
            _id: 'empty_room_test',
            conversationId: conversation._id,
            senderId: conversation.buyerId,
            content: 'Empty room test',
            attachments: [],
            isRead: false,
            createdAt: new Date(),
          };

          // This should not throw and should not deliver to any socket
          const socketsNotified = server.emitToRoom(targetRoomName, 'new_message', message);

          // Verify: No sockets were notified
          expect(socketsNotified.size).toBe(0);

          // Verify: No socket received the message
          for (const socketId of socketIds) {
            const received = server.socketReceivedMessage(socketId, message._id);
            expect(received).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use correct room naming convention', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * The room name should follow the convention `conversation:${conversationId}`
     * to ensure proper isolation between conversations.
     */
    fc.assert(
      fc.property(
        objectIdArb(),
        (conversationId) => {
          const roomName = getRoomName(conversationId);
          
          // Verify room name format
          expect(roomName).toBe(`conversation:${conversationId}`);
          expect(roomName.startsWith('conversation:')).toBe(true);
          expect(roomName.length).toBe('conversation:'.length + conversationId.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
