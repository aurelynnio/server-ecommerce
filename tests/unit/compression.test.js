import { describe, it, expect } from 'vitest';
const express = require('express');
const compression = require('compression');
const http = require('http');

describe('Compression Middleware', () => {
  it('should compress responses larger than default threshold with gzip', async () => {
    const testApp = express();
    testApp.use(compression());
    testApp.get('/test-compression', (req, res) => {
      res.send('x'.repeat(2048));
    });

    const server = http.createServer(testApp);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const contentEncoding = await new Promise((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/test-compression`,
          { headers: { 'accept-encoding': 'gzip' } },
          (res) => {
            resolve(res.headers['content-encoding']);
          },
        );
        req.on('error', reject);
      });

      expect(contentEncoding).toBe('gzip');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('should not compress responses when client does not accept gzip/br', async () => {
    const testApp = express();
    testApp.use(compression());
    testApp.get('/test-compression', (req, res) => {
      res.send('x'.repeat(2048));
    });

    const server = http.createServer(testApp);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const contentEncoding = await new Promise((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${port}/test-compression`,
          { headers: { 'accept-encoding': 'identity' } },
          (res) => {
            resolve(res.headers['content-encoding']);
          },
        );
        req.on('error', reject);
      });

      expect(contentEncoding).toBeUndefined();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
