import { describe, it, expect, vi, beforeEach } from 'vitest';
const HealthController = require('../../src/controllers/health.controller');
const mongoose = require('mongoose');
const redis = require('../../src/configs/redis.config');

describe('Health Checks (Liveness & Readiness)', () => {
  beforeEach(() => {
    HealthController._clearCache();
    vi.restoreAllMocks();
  });

  describe('GET /health/live', () => {
    it('should return 200 with status live and uptime', () => {
      const req = {};
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      HealthController.live(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('live');
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when MongoDB and Redis are active', async () => {
      // Mock mongoose readyState
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      // Mock redis
      vi.spyOn(redis, 'isReady').mockReturnValue(true);

      const req = {};
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      await HealthController.ready(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.services.mongodb).toBe('up');
      expect(res.body.services.redis).toBe('up');
    });

    it('should return 503 when MongoDB is down', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);
      vi.spyOn(redis, 'isReady').mockReturnValue(true);

      const req = {};
      const res = {
        statusCode: 0,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      await HealthController.ready(req, res);
      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.services.mongodb).toBe('down');
    });

    it('should serve cached readiness response within 10s TTL', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(redis, 'isReady').mockReturnValue(true);

      const res1 = {
        status(c) { this.statusCode = c; return this; },
        json(d) { this.body = d; return this; },
      };
      await HealthController.ready({}, res1);
      expect(res1.statusCode).toBe(200);

      // Now change mock to simulate DB drop
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

      const res2 = {
        status(c) { this.statusCode = c; return this; },
        json(d) { this.body = d; return this; },
      };
      // Calling immediately should return cached 200 without querying dropped DB
      await HealthController.ready({}, res2);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.status).toBe('ready');
    });
  });
});
