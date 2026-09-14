import { describe, it, expect } from 'vitest';
const { sanitizeUser, SENSITIVE_USER_FIELDS } = require('../../src/utils/user.util');

describe('User Utility', () => {
  describe('sanitizeUser', () => {
    it('returns null/undefined if input is falsy', () => {
      expect(sanitizeUser(null)).toBeNull();
      expect(sanitizeUser(undefined)).toBeUndefined();
    });

    it('removes all sensitive credential fields from a plain object', () => {
      const user = {
        _id: 'user123',
        username: 'alice',
        email: 'alice@example.com',
        password: 'hashedpassword',
        codeVerifiEmail: '123456',
        codeVerifiPassword: '654321',
        expiresCodeVerifiEmail: new Date(),
        expiresCodeVerifiPassword: new Date(),
        refreshTokenHash: 'hash123',
        refreshTokenExpiresAt: new Date(),
        roles: 'user',
      };

      const sanitized = sanitizeUser(user);

      expect(sanitized._id).toBe('user123');
      expect(sanitized.username).toBe('alice');
      expect(sanitized.email).toBe('alice@example.com');
      expect(sanitized.roles).toBe('user');

      for (const field of SENSITIVE_USER_FIELDS) {
        expect(sanitized[field]).toBeUndefined();
      }
    });

    it('works on a Mongoose-like document with toObject()', () => {
      const doc = {
        username: 'bob',
        password: 'secretpassword',
        toObject: () => ({
          username: 'bob',
          password: 'secretpassword',
          codeVerifiEmail: '999999',
        }),
      };

      const sanitized = sanitizeUser(doc);
      expect(sanitized.username).toBe('bob');
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.codeVerifiEmail).toBeUndefined();
    });
  });
});
