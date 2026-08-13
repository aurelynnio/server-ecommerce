import { afterEach, describe, expect, it } from 'vitest';

const originalEnv = { ...process.env };

const loadCorsMiddleware = () => {
  delete require.cache[require.resolve('../../src/middlewares/cors.middleware')];
  return require('../../src/middlewares/cors.middleware');
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('CORS origin policy', () => {
  it('allows localhost on any port outside production', () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedOrigin } = loadCorsMiddleware();

    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
  });

  it('does not mistake a lookalike domain for localhost', () => {
    process.env.NODE_ENV = 'development';
    const { isAllowedOrigin } = loadCorsMiddleware();

    expect(isAllowedOrigin('http://localhost.evil.example')).toBe(false);
  });

  it('allows configured origins after normalizing trailing slashes', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URLS = 'https://app.example.com/, https://admin.example.com';
    const { isAllowedOrigin } = loadCorsMiddleware();

    expect(isAllowedOrigin('https://app.example.com')).toBe(true);
    expect(isAllowedOrigin('https://admin.example.com/')).toBe(true);
  });

  it('rejects localhost in production unless explicitly configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;
    const { isAllowedOrigin } = loadCorsMiddleware();

    expect(isAllowedOrigin('http://localhost:3000')).toBe(false);
  });
});
