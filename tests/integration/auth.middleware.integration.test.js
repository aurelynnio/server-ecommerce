/**
 * Integration Tests: Auth Middleware
 * Tests JWT verification, role checking, and auth flow
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Mock User model
vi.mock('../../src/models/user.model', () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
  },
}));

// Mock permission service
vi.mock('../../src/services/permission.service', () => ({
  default: {
    getUserPermissions: vi.fn((user) => {
      if (user.roles === 'admin') return ['product:create', 'product:update', 'user:delete'];
      if (user.roles === 'seller') return ['product:create', 'product:update'];
      return ['product:read'];
    }),
  },
}));

// We import after mocking
const { verifyAccessToken, requireRole } = await import('../../src/middlewares/auth.middleware.js');

describe('Auth Middleware - Integration Tests', () => {
  const createMockReqRes = (options = {}) => {
    const req = {
      cookies: options.cookies || {},
      headers: options.headers || {},
      user: options.user || null,
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  describe('verifyAccessToken', () => {
    it('should authenticate with valid cookie token', () => {
      const token = jwt.sign(
        {
          userId: 'user123',
          username: 'test',
          email: 'test@t.com',
          role: 'user',
          permissions: ['product:read'],
        },
        ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken: token },
      });

      verifyAccessToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('user123');
      expect(req.user.username).toBe('test');
      expect(req.user.permissions).toContain('product:read');
    });

    it('should authenticate with Bearer token in header', () => {
      const token = jwt.sign(
        {
          userId: 'user456',
          username: 'admin',
          email: 'admin@t.com',
          role: 'admin',
          permissions: [],
        },
        ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      verifyAccessToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('user456');
    });

    it('should reject request without token', () => {
      const { req, res, next } = createMockReqRes();

      verifyAccessToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired token', () => {
      const token = jwt.sign({ userId: 'user123' }, ACCESS_SECRET, {
        expiresIn: '0s',
      });
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken: token },
      });

      verifyAccessToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject invalid token', () => {
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken: 'invalid.token.here' },
      });

      verifyAccessToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject token signed with wrong secret', () => {
      const token = jwt.sign({ userId: 'user123' }, 'wrong-secret', {
        expiresIn: '30m',
      });
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken: token },
      });

      verifyAccessToken(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should prefer cookie token over header token', () => {
      const cookieToken = jwt.sign(
        {
          userId: 'cookie-user',
          username: 'c',
          email: 'c@t.com',
          role: 'user',
        },
        ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      const headerToken = jwt.sign(
        {
          userId: 'header-user',
          username: 'h',
          email: 'h@t.com',
          role: 'user',
        },
        ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken: cookieToken },
        headers: { authorization: `Bearer ${headerToken}` },
      });

      verifyAccessToken(req, res, next);

      expect(req.user.userId).toBe('cookie-user');
    });
  });

  describe('requireRole', () => {
    it('should reject unauthenticated user', async () => {
      const { req, res, next } = createMockReqRes();
      const middleware = requireRole('admin');

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should allow user with matching role', async () => {
      const { req, res, next } = createMockReqRes({
        user: { userId: 'u1', role: 'admin' },
      });
      req.user = { userId: 'u1', role: 'admin' };
      const middleware = requireRole('admin');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject user without matching role', async () => {
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'u1', role: 'user' };
      const middleware = requireRole('admin');

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow any matching role from multiple', async () => {
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'u1', role: 'seller' };
      const middleware = requireRole('admin', 'seller');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should support roles field as array', async () => {
      const { req, res, next } = createMockReqRes();
      req.user = { userId: 'u1', roles: ['admin', 'user'] };
      const middleware = requireRole('admin');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Full Auth Flow Integration', () => {
    it('should generate tokens and verify them', () => {
      // 1. Generate tokens (simulating login)
      const user = {
        _id: 'userId1',
        username: 'testuser',
        email: 'test@test.com',
        roles: 'user',
      };
      const permissions = ['product:read'];

      const accessToken = jwt.sign(
        {
          userId: user._id,
          username: user.username,
          email: user.email,
          role: user.roles,
          permissions,
        },
        ACCESS_SECRET,
        { expiresIn: '30m' },
      );
      const refreshToken = jwt.sign({ userId: user._id }, REFRESH_SECRET, {
        expiresIn: '16d',
      });

      // 2. Verify access token
      const decoded = jwt.verify(accessToken, ACCESS_SECRET);
      expect(decoded.userId).toBe('userId1');
      expect(decoded.permissions).toContain('product:read');

      // 3. Verify refresh token
      const refreshDecoded = jwt.verify(refreshToken, REFRESH_SECRET);
      expect(refreshDecoded.userId).toBe('userId1');

      // 4. Use in middleware
      const { req, res, next } = createMockReqRes({
        cookies: { accessToken },
      });
      verifyAccessToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('userId1');
    });
  });
});
