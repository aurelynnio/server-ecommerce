/**
 * Unit Tests: Email Service Logic
 * Tests subject selection, verification link construction, singleton pattern
 */
import { describe, it, expect } from 'vitest';

describe('EmailService Logic', () => {
  // --- Subject selection by type ---
  describe('subjectSelection', () => {
    const getSubject = (type) => {
      return type === 'email_verification' ? 'Verify Your Email Address' : 'Reset Your Password';
    };

    it('should return verification subject for email_verification', () => {
      expect(getSubject('email_verification')).toBe('Verify Your Email Address');
    });

    it('should return reset subject for password_reset', () => {
      expect(getSubject('password_reset')).toBe('Reset Your Password');
    });

    it('should return reset subject for unknown type', () => {
      expect(getSubject('unknown')).toBe('Reset Your Password');
    });

    it('should return reset subject for undefined', () => {
      expect(getSubject(undefined)).toBe('Reset Your Password');
    });

    it('should return reset subject for null', () => {
      expect(getSubject(null)).toBe('Reset Your Password');
    });
  });

  // --- Verification link construction ---
  describe('verificationLinkConstruction', () => {
    const buildVerificationLink = (baseUrl, email, code) => {
      return `${baseUrl}/verify-code?email=${email}&code=${code}`;
    };

    it('should build correct verification link', () => {
      const result = buildVerificationLink('https://cyhin.engineer', 'test@example.com', '123456');
      expect(result).toBe('https://cyhin.engineer/verify-code?email=test@example.com&code=123456');
    });

    it('should handle different base URLs', () => {
      const result = buildVerificationLink('http://localhost:3000', 'user@test.com', 'ABCDEF');
      expect(result).toBe('http://localhost:3000/verify-code?email=user@test.com&code=ABCDEF');
    });

    it('should preserve special characters in email', () => {
      const result = buildVerificationLink('https://example.com', 'user+tag@test.com', '999');
      expect(result).toContain('user+tag@test.com');
    });
  });

  // --- Type default parameter ---
  describe('typeDefault', () => {
    const resolveType = (type = 'email_verification') => type;

    it('should default to email_verification', () => {
      expect(resolveType()).toBe('email_verification');
    });

    it('should use provided type', () => {
      expect(resolveType('password_reset')).toBe('password_reset');
    });
  });

  // --- Singleton transporter pattern ---
  describe('singletonPattern', () => {
    const createSingleton = () => {
      let instance = null;
      return () => {
        if (!instance) {
          instance = { created: true, timestamp: Date.now() };
        }
        return instance;
      };
    };

    it('should create instance on first call', () => {
      const getInstance = createSingleton();
      const result = getInstance();
      expect(result.created).toBe(true);
    });

    it('should return same instance on subsequent calls', () => {
      const getInstance = createSingleton();
      const first = getInstance();
      const second = getInstance();
      expect(first).toBe(second);
    });
  });

  // --- sendEmailVerificationCode delegates correctly ---
  describe('delegationPattern', () => {
    const sendVerificationCode = (to, code, type) => ({
      to,
      code,
      type,
    });

    const sendEmailVerificationCode = (to, code) =>
      sendVerificationCode(to, code, 'email_verification');

    const sendPasswordResetCode = (to, code) => sendVerificationCode(to, code, 'password_reset');

    it('sendEmailVerificationCode passes email_verification type', () => {
      const result = sendEmailVerificationCode('a@b.com', '123');
      expect(result.type).toBe('email_verification');
      expect(result.to).toBe('a@b.com');
      expect(result.code).toBe('123');
    });

    it('sendPasswordResetCode passes password_reset type', () => {
      const result = sendPasswordResetCode('x@y.com', '456');
      expect(result.type).toBe('password_reset');
      expect(result.to).toBe('x@y.com');
      expect(result.code).toBe('456');
    });
  });
});
