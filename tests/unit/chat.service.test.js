/**
 * Unit Tests: Chat Service Logic
 * Tests membership validation, message reversal, mark-as-read filtering
 */
import { describe, it, expect } from "vitest";

describe("ChatService Logic", () => {
  // --- Membership check ---
  describe("membershipCheck", () => {
    const isMember = (members, userId) => {
      return members.some(
        (memberId) => memberId.toString() === userId.toString(),
      );
    };

    it("should confirm member exists", () => {
      expect(isMember(["u1", "u2"], "u1")).toBe(true);
    });

    it("should reject non-member", () => {
      expect(isMember(["u1", "u2"], "u3")).toBe(false);
    });

    it("should handle empty members", () => {
      expect(isMember([], "u1")).toBe(false);
    });

    it("should handle string/number comparison via toString", () => {
      const objLike = { toString: () => "u1" };
      expect(isMember(["u1", "u2"], objLike)).toBe(true);
    });
  });

  // --- Message reversal for chronological order ---
  describe("messageReversal", () => {
    const getChronologicalMessages = (messages) => {
      return [...messages].reverse();
    };

    it("should reverse messages for chronological order", () => {
      const messages = [
        { _id: "3", content: "Latest", createdAt: 3 },
        { _id: "2", content: "Middle", createdAt: 2 },
        { _id: "1", content: "Oldest", createdAt: 1 },
      ];
      const result = getChronologicalMessages(messages);
      expect(result[0]._id).toBe("1");
      expect(result[2]._id).toBe("3");
    });

    it("should not modify original array", () => {
      const messages = [{ _id: "2" }, { _id: "1" }];
      getChronologicalMessages(messages);
      expect(messages[0]._id).toBe("2");
    });

    it("should handle single message", () => {
      const result = getChronologicalMessages([{ _id: "1" }]);
      expect(result).toEqual([{ _id: "1" }]);
    });

    it("should handle empty array", () => {
      expect(getChronologicalMessages([])).toEqual([]);
    });
  });

  // --- markAsRead: only mark OTHER's messages ---
  describe("markAsReadFilter", () => {
    const getUnreadFromOthers = (messages, userId) => {
      return messages.filter(
        (m) => m.senderId.toString() !== userId.toString() && !m.isRead,
      );
    };

    it("should find unread messages from others", () => {
      const messages = [
        { senderId: "u1", isRead: false, content: "Hi" },
        { senderId: "u2", isRead: false, content: "Hello" },
        { senderId: "u2", isRead: true, content: "Old" },
      ];
      const result = getUnreadFromOthers(messages, "u1");
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("Hello");
    });

    it("should not include own messages", () => {
      const messages = [{ senderId: "u1", isRead: false, content: "My msg" }];
      const result = getUnreadFromOthers(messages, "u1");
      expect(result).toHaveLength(0);
    });

    it("should not include already read messages", () => {
      const messages = [{ senderId: "u2", isRead: true, content: "Read" }];
      const result = getUnreadFromOthers(messages, "u1");
      expect(result).toHaveLength(0);
    });

    it("should handle empty messages", () => {
      expect(getUnreadFromOthers([], "u1")).toEqual([]);
    });
  });

  // --- Conversation dedup (startConversation) ---
  describe("conversationDedup", () => {
    const findExistingConversation = (
      conversations,
      userId,
      sellerId,
      shopId,
    ) => {
      return conversations.find(
        (c) =>
          c.shopId === shopId &&
          c.members.includes(userId) &&
          c.members.includes(sellerId),
      );
    };

    it("should find existing conversation", () => {
      const convs = [
        { members: ["u1", "seller1"], shopId: "s1" },
        { members: ["u2", "seller2"], shopId: "s2" },
      ];
      const result = findExistingConversation(convs, "u1", "seller1", "s1");
      expect(result).toBeDefined();
      expect(result.shopId).toBe("s1");
    });

    it("should return undefined if no match", () => {
      const convs = [{ members: ["u1", "seller1"], shopId: "s1" }];
      const result = findExistingConversation(convs, "u2", "seller1", "s1");
      expect(result).toBeUndefined();
    });

    it("should require same shopId", () => {
      const convs = [{ members: ["u1", "seller1"], shopId: "s1" }];
      const result = findExistingConversation(convs, "u1", "seller1", "s2");
      expect(result).toBeUndefined();
    });
  });
});
