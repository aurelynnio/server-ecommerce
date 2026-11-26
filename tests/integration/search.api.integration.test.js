/**
 * Integration test thật qua Express 5: chứng minh validate.middleware ghi đè
 * được req.query (getter-only trên prototype) và Joi normalization có hiệu lực.
 * Không cần Mongo/Redis vì handler chỉ echo query đã validate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const express = require('express');
const validate = require('../../src/middlewares/validate.middleware');
const {
  searchQueryValidator,
  suggestionQueryValidator,
} = require('../../src/validations/search.validator');
const { getReviewsQueryValidator } = require('../../src/validations/review.validator');

const app = express();
app.get(
  '/suggestions',
  validate({ query: suggestionQueryValidator }),
  (req, res) => res.json({ q: req.query.q ?? null, limit: req.query.limit }),
);
app.get('/search', validate({ query: searchQueryValidator }), (req, res) =>
  res.json({
    q: req.query.q ?? null,
    minPrice: req.query.minPrice ?? null,
    maxPrice: req.query.maxPrice ?? null,
    limit: req.query.limit,
    page: req.query.page,
    sort: req.query.sort ?? null,
  }),
);
app.get('/reviews/seller/me', validate({ query: getReviewsQueryValidator }), (req, res) =>
  res.json({
    rating: req.query.rating ?? null,
    replyStatus: req.query.replyStatus ?? null,
    page: req.query.page,
    limit: req.query.limit,
  }),
);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.statusCode || err.status || 500).json({ message: err.message });
});

let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('GET /api/search* through real Express 5 middleware', () => {
  it('trims q and applies limit default instead of passing whitespace through', async () => {
    const res = await fetch(`${baseUrl}/suggestions?q=%20%20`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.q).toBeNull();
    expect(body.limit).toBe(10);
  });

  it('trims surrounding spaces on non-empty keywords', async () => {
    const res = await fetch(`${baseUrl}/suggestions?q=%20Laptop%20`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.q).toBe('Laptop');
  });

  it('rejects repeated scalar params', async () => {
    const res = await fetch(`${baseUrl}/search?q=a&q=b`);

    expect(res.status).toBe(400);
  });

  it('accepts minPrice=0 and rejects unbounded limit', async () => {
    const ok = await fetch(`${baseUrl}/search?minPrice=0&maxPrice=500000&limit=100`);
    const okBody = await ok.json();
    expect(ok.status).toBe(200);
    expect(okBody.minPrice).toBe(0);
    expect(okBody.maxPrice).toBe(500000);
    expect(okBody.limit).toBe(100);

    const tooLarge = await fetch(`${baseUrl}/search?limit=100000`);
    expect(tooLarge.status).toBe(400);
  });

  it('applies page/sort defaults', async () => {
    const res = await fetch(`${baseUrl}/search`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.sort).toBeNull();
    expect(body.limit).toBe(20);
  });

  it('preserves replyStatus on GET /reviews/seller/me and rejects invalid values', async () => {
    const ok = await fetch(`${baseUrl}/reviews/seller/me?rating=5&replyStatus=unreplied`);
    const okBody = await ok.json();
    expect(ok.status).toBe(200);
    expect(okBody.rating).toBe(5);
    expect(okBody.replyStatus).toBe('unreplied');

    const bad = await fetch(`${baseUrl}/reviews/seller/me?replyStatus=invalid`);
    expect(bad.status).toBe(400);
  });
});
