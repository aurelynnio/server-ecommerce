import { describe, it, expect } from 'vitest';
const { getRequestId, runWithContext } = require('../../src/utils/asyncContext');
const requestIdMiddleware = require('../../src/middlewares/requestId.middleware');

describe('AsyncContext & RequestId Middleware', () => {
  it('should store and retrieve requestId within execution context', () => {
    runWithContext({ requestId: 'trace-test-123' }, () => {
      expect(getRequestId()).toBe('trace-test-123');
    });
    expect(getRequestId()).toBeUndefined();
  });

  it('requestIdMiddleware should reuse incoming X-Request-Id header', () => {
    const req = {
      headers: { 'x-request-id': 'custom-client-request-id' },
      path: '/api/orders',
      method: 'POST',
    };
    const res = {
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
    };

    let contextId;
    requestIdMiddleware(req, res, () => {
      contextId = getRequestId();
    });

    expect(res.headers['X-Request-Id']).toBe('custom-client-request-id');
    expect(req.id).toBe('custom-client-request-id');
    expect(contextId).toBe('custom-client-request-id');
  });

  it('requestIdMiddleware should generate a UUID if header is missing', () => {
    const req = {
      headers: {},
      path: '/api/auth/login',
      method: 'POST',
    };
    const res = {
      headers: {},
      setHeader(name, val) {
        this.headers[name] = val;
      },
    };

    let contextId;
    requestIdMiddleware(req, res, () => {
      contextId = getRequestId();
    });

    expect(typeof res.headers['X-Request-Id']).toBe('string');
    expect(res.headers['X-Request-Id'].length).toBeGreaterThan(10);
    expect(contextId).toBe(res.headers['X-Request-Id']);
  });
});
