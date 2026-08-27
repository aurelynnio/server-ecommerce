import { describe, it, expect } from 'vitest';
const { normalizeRoute } = require('../../src/middlewares/metrics.middleware');

describe('Metrics Middleware - Route Normalization & High Cardinality Prevention', () => {
  it('should preserve Express route template pattern if available', () => {
    const req = {
      baseUrl: '/api/products',
      route: { path: '/:id' },
    };
    expect(normalizeRoute(req)).toBe('/api/products/:id');
  });

  it('should clean MongoDB ObjectId (24 hex characters) from unmatched URLs', () => {
    const req = {
      originalUrl: '/api/products/65df8a76b91234567890abcd',
      path: '/api/products/65df8a76b91234567890abcd',
    };
    expect(normalizeRoute(req)).toBe('/api/products/:id');
  });

  it('should clean UUIDs from unmatched URLs', () => {
    const req = {
      originalUrl: '/api/orders/e2b694b8-0f73-4ea2-8d76-921c1f7a0123/status',
      path: '/api/orders/e2b694b8-0f73-4ea2-8d76-921c1f7a0123/status',
    };
    expect(normalizeRoute(req)).toBe('/api/orders/:id/status');
  });

  it('should clean numeric IDs in URL segments', () => {
    const req = {
      originalUrl: '/api/categories/98765/subcategories/4321',
      path: '/api/categories/98765/subcategories/4321',
    };
    expect(normalizeRoute(req)).toBe('/api/categories/:id/subcategories/:id');
  });

  it('should strip query parameters from raw URL', () => {
    const req = {
      originalUrl: '/api/products?page=1&limit=20&sort=desc',
      path: '/api/products',
    };
    expect(normalizeRoute(req)).toBe('/api/products');
  });
});
