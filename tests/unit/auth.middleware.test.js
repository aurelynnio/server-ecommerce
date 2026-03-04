/**
 * Unit Tests: Auth Middleware Logic
 * Tests token extraction, Bearer prefix strip, role flattening, seller role check
 */
import { describe, it, expect } from 'vitest';

describe('AuthMiddleware Logic', () => {
  // --- Token extraction from cookie vs header ---
  describe('tokenExtraction', () => {
    const extractToken = (cookies, headers) => {
      let token = cookies?.accessToken;

      if (!token && headers?.authorization) {
        const authHeader = headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      return token || null;
    };

    it('should extract from cookie first', () => {
      const result = extractToken(
        { accessToken: 'cookie-token' },
        { authorization: 'Bearer header-token' },
      );
      expect(result).toBe('cookie-token');
    });

    it('should fallback to Authorization header when no cookie', () => {
      const result = extractToken(null, {
        authorization: 'Bearer header-token',
      });
      expect(result).toBe('header-token');
    });

    it('should strip Bearer prefix from header', () => {
      const result = extractToken(
        {},
        {
          authorization: 'Bearer abc123',
        },
      );
      expect(result).toBe('abc123');
    });

    it('should return null when no token found', () => {
      expect(extractToken({}, {})).toBeNull();
    });

    it('should return null when cookies is undefined', () => {
      expect(extractToken(undefined, {})).toBeNull();
    });

    it('should return null when authorization header missing Bearer prefix', () => {
      const result = extractToken(null, { authorization: 'Token abc' });
      expect(result).toBeNull();
    });

    it('should return null when authorization header is empty', () => {
      const result = extractToken(null, { authorization: '' });
      expect(result).toBeNull();
    });

    it('should handle Bearer with only prefix (no token)', () => {
      const result = extractToken(null, { authorization: 'Bearer ' });
      // substring(7) returns "" which is falsy
      expect(result).toBeNull();
    });
  });

  // --- User info assembly from decoded token ---
  describe('userInfoAssembly', () => {
    const assembleUser = (decoded) => ({
      _id: decoded.userId,
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    });

    it('should map decoded token fields correctly', () => {
      const decoded = {
        userId: 'u1',
        username: 'john',
        email: 'john@test.com',
        role: 'user',
        permissions: ['read'],
      };
      const result = assembleUser(decoded);
      expect(result._id).toBe('u1');
      expect(result.userId).toBe('u1');
      expect(result.username).toBe('john');
      expect(result.email).toBe('john@test.com');
      expect(result.role).toBe('user');
      expect(result.permissions).toEqual(['read']);
    });

    it('should default permissions to empty array', () => {
      const decoded = {
        userId: 'u1',
        username: 'a',
        email: 'a@b.c',
        role: 'user',
      };
      expect(assembleUser(decoded).permissions).toEqual([]);
    });

    it('should keep both _id and userId for backward compat', () => {
      const decoded = {
        userId: 'u1',
        username: 'a',
        email: 'a@b.c',
        role: 'user',
      };
      const result = assembleUser(decoded);
      expect(result._id).toBe(result.userId);
    });
  });

  // --- Error type detection ---
  describe('errorTypeDetection', () => {
    const getErrorResponse = (error) => {
      if (error.name === 'TokenExpiredError') {
        return {
          message: 'Access token has expired. Please refresh your token.',
          status: 401,
        };
      }
      if (error.name === 'JsonWebTokenError') {
        return {
          message: 'Invalid access token. Please login again.',
          status: 401,
        };
      }
      return { message: 'Authentication failed', status: 401 };
    };

    it('should detect TokenExpiredError', () => {
      const result = getErrorResponse({ name: 'TokenExpiredError' });
      expect(result.message).toContain('expired');
    });

    it('should detect JsonWebTokenError', () => {
      const result = getErrorResponse({ name: 'JsonWebTokenError' });
      expect(result.message).toContain('Invalid');
    });

    it('should return generic message for unknown error', () => {
      const result = getErrorResponse({ name: 'SomeError' });
      expect(result.message).toBe('Authentication failed');
    });
  });

  // --- Role flattening (requireRole) ---
  describe('roleFlattening', () => {
    const flattenRoles = (...allowedRoles) => allowedRoles.flat();

    it('should flatten nested arrays', () => {
      expect(flattenRoles(['admin', 'user'])).toEqual(['admin', 'user']);
    });

    it('should keep flat args as-is', () => {
      expect(flattenRoles('admin', 'user')).toEqual(['admin', 'user']);
    });

    it('should flatten mixed', () => {
      expect(flattenRoles('admin', ['user', 'seller'])).toEqual(['admin', 'user', 'seller']);
    });

    it('should handle single role', () => {
      expect(flattenRoles('admin')).toEqual(['admin']);
    });

    it('should handle empty call', () => {
      expect(flattenRoles()).toEqual([]);
    });
  });

  // --- User roles extraction ---
  describe('userRolesExtraction', () => {
    const extractUserRoles = (user) => {
      let userRoles = [];
      if (user.role) {
        userRoles = Array.isArray(user.role) ? user.role : [user.role];
      }
      if (user.roles) {
        const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
        userRoles = [...userRoles, ...roles];
      }
      return userRoles;
    };

    it('should extract single role string', () => {
      expect(extractUserRoles({ role: 'admin' })).toEqual(['admin']);
    });

    it('should extract role array', () => {
      expect(extractUserRoles({ role: ['admin', 'user'] })).toEqual(['admin', 'user']);
    });

    it('should merge role and roles', () => {
      expect(extractUserRoles({ role: 'admin', roles: 'seller' })).toEqual(['admin', 'seller']);
    });

    it('should merge role and roles arrays', () => {
      expect(extractUserRoles({ role: ['admin'], roles: ['seller', 'user'] })).toEqual([
        'admin',
        'seller',
        'user',
      ]);
    });

    it('should return empty when no roles', () => {
      expect(extractUserRoles({})).toEqual([]);
    });
  });

  // --- Role check logic ---
  describe('roleCheckLogic', () => {
    const hasAllowedRole = (userRoles, flatRoles) => {
      return flatRoles.some((role) => userRoles.includes(role));
    };

    it('should allow when user has matching role', () => {
      expect(hasAllowedRole(['admin'], ['admin', 'user'])).toBe(true);
    });

    it('should deny when user has no matching role', () => {
      expect(hasAllowedRole(['user'], ['admin'])).toBe(false);
    });

    it('should handle multiple user roles', () => {
      expect(hasAllowedRole(['user', 'seller'], ['seller'])).toBe(true);
    });

    it('should handle empty user roles', () => {
      expect(hasAllowedRole([], ['admin'])).toBe(false);
    });

    it('should handle empty allowed roles', () => {
      expect(hasAllowedRole(['admin'], [])).toBe(false);
    });
  });

  // --- Optional auth pattern ---
  describe('optionalAuthPattern', () => {
    const handleOptionalAuth = (token, decoded) => {
      if (!token) return { user: null };
      if (!decoded) return { user: null };
      return { user: decoded };
    };

    it('should return null user when no token', () => {
      expect(handleOptionalAuth(null, null).user).toBeNull();
    });

    it('should return null user when token invalid (decoded null)', () => {
      expect(handleOptionalAuth('some-token', null).user).toBeNull();
    });

    it('should return user when token valid', () => {
      const decoded = { userId: 'u1', username: 'test' };
      expect(handleOptionalAuth('valid', decoded).user).toEqual(decoded);
    });
  });
});
