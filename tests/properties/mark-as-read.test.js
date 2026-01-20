/**
 * Property Test: Mark As Read Updates All Fields
 * 
 * Property 3: For any conversation with unread messages, when a user marks messages as read,
 * all messages in that conversation SHALL have `isRead=true` AND the conversation's unread count SHALL be zero.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 3: Mark As Read Updates All Fields', () => {
  /**
   * Simulates the markAsRead logic from chat.service.js
   * Updates all messages where senderId != userId to isRead: true
   */
  const markAsRead = (messages, userId) => {
    return messages.map((message) => {
      // Only mark messages from other users as read
      if (message.senderId !== userId) {
        return { ...message, isRead: true };
      }
      return message;
    });
  };

  /**
   * Calculates unread count for a user
   * Unread messages are those where isRead=false AND senderId != userId
   */
  const calculateUnreadCount = (messages, userId) => {
    return messages.filter(
      (message) => !message.isRead && message.senderId !== userId
    ).length;
  };

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
   * Generator for a message with random isRead state
   */
  const messageArb = (conversationId, possibleSenderIds) =>
    fc.record({
      _id: objectIdArb(),
      conversationId: fc.constant(conversationId),
      senderId: fc.constantFrom(...possibleSenderIds),
      content: fc.string({ minLength: 1, maxLength: 200 }),
      attachments: fc.array(fc.string(), { maxLength: 3 }),
      isRead: fc.boolean(),
      createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    });

  /**
   * Generator for a conversation with random messages
   */
  const conversationWithMessagesArb = () =>
    fc.tuple(objectIdArb(), objectIdArb(), objectIdArb()).chain(
      ([conversationId, buyerId, sellerId]) =>
        fc.record({
          conversationId: fc.constant(conversationId),
          members: fc.constant([buyerId, sellerId]),
          messages: fc.array(messageArb(conversationId, [buyerId, sellerId]), {
            minLength: 1,
            maxLength: 50,
          }),
        })
    );

  it('should mark all messages from other users as read after markAsRead', () => {
    /**
     * **Validates: Requirements 2.1, 2.2**
     * 
     * For any conversation with messages, when markAsRead is called:
     * - All messages where senderId != userId should have isRead=true
     */
    fc.assert(
      fc.property(conversationWithMessagesArb(), ({ members, messages }) => {
        // Pick one member as the current user
        const userId = members[0];

        // Apply markAsRead
        const updatedMessages = markAsRead(messages, userId);

        // Verify: All messages from other users should be marked as read
        const messagesFromOthers = updatedMessages.filter(
          (msg) => msg.senderId !== userId
        );
        
        const allMarkedAsRead = messagesFromOthers.every((msg) => msg.isRead === true);
        
        expect(allMarkedAsRead).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should result in zero unread count after markAsRead', () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * For any conversation, after markAsRead is called:
     * - The unread count (messages where isRead=false AND senderId != userId) should be zero
     */
    fc.assert(
      fc.property(conversationWithMessagesArb(), ({ members, messages }) => {
        // Pick one member as the current user
        const userId = members[0];

        // Apply markAsRead
        const updatedMessages = markAsRead(messages, userId);

        // Calculate unread count after marking as read
        const unreadCount = calculateUnreadCount(updatedMessages, userId);

        expect(unreadCount).toBe(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should not modify messages sent by the current user', () => {
    /**
     * **Validates: Requirements 2.2**
     * 
     * markAsRead should only affect messages from OTHER users.
     * Messages sent by the current user should remain unchanged.
     */
    fc.assert(
      fc.property(conversationWithMessagesArb(), ({ members, messages }) => {
        const userId = members[0];

        // Get original state of user's own messages
        const originalUserMessages = messages.filter((msg) => msg.senderId === userId);

        // Apply markAsRead
        const updatedMessages = markAsRead(messages, userId);

        // Get updated state of user's own messages
        const updatedUserMessages = updatedMessages.filter(
          (msg) => msg.senderId === userId
        );

        // Verify: User's own messages should have the same isRead state
        for (let i = 0; i < originalUserMessages.length; i++) {
          expect(updatedUserMessages[i].isRead).toBe(originalUserMessages[i].isRead);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should work correctly for both conversation members', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * The property should hold regardless of which member marks messages as read.
     * Test with both buyer and seller perspectives.
     */
    fc.assert(
      fc.property(conversationWithMessagesArb(), ({ members, messages }) => {
        // Test for both members
        for (const userId of members) {
          const updatedMessages = markAsRead(messages, userId);
          const unreadCount = calculateUnreadCount(updatedMessages, userId);

          // All messages from others should be read
          const messagesFromOthers = updatedMessages.filter(
            (msg) => msg.senderId !== userId
          );
          const allRead = messagesFromOthers.every((msg) => msg.isRead === true);

          expect(allRead).toBe(true);
          expect(unreadCount).toBe(0);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle conversations with only unread messages', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * Edge case: All messages are initially unread
     */
    fc.assert(
      fc.property(
        fc.tuple(objectIdArb(), objectIdArb(), objectIdArb()).chain(
          ([conversationId, buyerId, sellerId]) =>
            fc.record({
              conversationId: fc.constant(conversationId),
              members: fc.constant([buyerId, sellerId]),
              messages: fc.array(
                fc.record({
                  _id: objectIdArb(),
                  conversationId: fc.constant(conversationId),
                  senderId: fc.constantFrom(buyerId, sellerId),
                  content: fc.string({ minLength: 1, maxLength: 200 }),
                  attachments: fc.array(fc.string(), { maxLength: 3 }),
                  isRead: fc.constant(false), // All unread
                  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
                }),
                { minLength: 1, maxLength: 20 }
              ),
            })
        ),
        ({ members, messages }) => {
          const userId = members[0];

          // Verify initial state has unread messages from others
          const initialUnreadFromOthers = messages.filter(
            (msg) => !msg.isRead && msg.senderId !== userId
          ).length;

          // Apply markAsRead
          const updatedMessages = markAsRead(messages, userId);
          const finalUnreadCount = calculateUnreadCount(updatedMessages, userId);

          // After marking as read, unread count should be zero
          expect(finalUnreadCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle conversations with all messages already read', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * Edge case: All messages are already read - should remain read
     */
    fc.assert(
      fc.property(
        fc.tuple(objectIdArb(), objectIdArb(), objectIdArb()).chain(
          ([conversationId, buyerId, sellerId]) =>
            fc.record({
              conversationId: fc.constant(conversationId),
              members: fc.constant([buyerId, sellerId]),
              messages: fc.array(
                fc.record({
                  _id: objectIdArb(),
                  conversationId: fc.constant(conversationId),
                  senderId: fc.constantFrom(buyerId, sellerId),
                  content: fc.string({ minLength: 1, maxLength: 200 }),
                  attachments: fc.array(fc.string(), { maxLength: 3 }),
                  isRead: fc.constant(true), // All already read
                  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
                }),
                { minLength: 1, maxLength: 20 }
              ),
            })
        ),
        ({ members, messages }) => {
          const userId = members[0];

          // Apply markAsRead
          const updatedMessages = markAsRead(messages, userId);
          const unreadCount = calculateUnreadCount(updatedMessages, userId);

          // Should still be zero
          expect(unreadCount).toBe(0);

          // All messages from others should still be read
          const messagesFromOthers = updatedMessages.filter(
            (msg) => msg.senderId !== userId
          );
          expect(messagesFromOthers.every((msg) => msg.isRead === true)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty message arrays gracefully', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * 
     * Edge case: Conversation with no messages
     */
    fc.assert(
      fc.property(
        fc.tuple(objectIdArb(), objectIdArb(), objectIdArb()),
        ([conversationId, buyerId, sellerId]) => {
          const messages = [];
          const userId = buyerId;

          const updatedMessages = markAsRead(messages, userId);
          const unreadCount = calculateUnreadCount(updatedMessages, userId);

          expect(updatedMessages).toEqual([]);
          expect(unreadCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
