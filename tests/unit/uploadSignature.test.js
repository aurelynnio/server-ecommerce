/**
 * Unit Tests: Upload Signature Middleware
 * Tests image magic byte detection (pure buffer checks)
 */
import { describe, it, expect } from 'vitest';

// The functions are not exported directly, so we test via validateImageSignature
// But we can test the public middleware + re-implement the checks
// Let's test the middleware behavior with mock files

const { validateImageSignature } = require('../../src/middlewares/uploadSignature.middleware');

// Helper: build buffer with specific bytes
const makeBuffer = (bytes) => Buffer.from(bytes);

describe('Upload Signature Middleware', () => {
  describe('JPEG detection', () => {
    it('should accept valid JPEG magic bytes', () => {
      const file = {
        buffer: makeBuffer([0xff, 0xd8, 0xff, 0xe0, 0x00]),
        mimetype: 'image/jpeg',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject invalid JPEG', () => {
      const file = {
        buffer: makeBuffer([0x00, 0x00, 0x00]),
        mimetype: 'image/jpeg',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });
  });

  describe('PNG detection', () => {
    it('should accept valid PNG', () => {
      const file = {
        buffer: makeBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
        mimetype: 'image/png',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('GIF detection', () => {
    it('should accept GIF87a', () => {
      const file = {
        buffer: Buffer.from('GIF87a' + '\x00'.repeat(10)),
        mimetype: 'image/gif',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should accept GIF89a', () => {
      const file = {
        buffer: Buffer.from('GIF89a' + '\x00'.repeat(10)),
        mimetype: 'image/gif',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('WebP detection', () => {
    it('should accept valid WebP (RIFF...WEBP)', () => {
      const buf = Buffer.alloc(16);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(100, 4);
      buf.write('WEBP', 8);
      const file = { buffer: buf, mimetype: 'image/webp' };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject RIFF without WEBP', () => {
      const buf = Buffer.alloc(16);
      buf.write('RIFF', 0);
      buf.writeUInt32LE(100, 4);
      buf.write('WAVE', 8);
      const file = { buffer: buf, mimetype: 'image/webp' };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });
  });

  describe('SVG detection', () => {
    it('should accept SVG with correct mimetype', () => {
      const file = {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'),
        mimetype: 'image/svg+xml',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject SVG content with wrong mimetype', () => {
      const file = {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'),
        mimetype: 'application/octet-stream',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });
  });

  describe('Multiple files', () => {
    it('should accept array of valid files', () => {
      const files = [
        {
          buffer: makeBuffer([0xff, 0xd8, 0xff]),
          mimetype: 'image/jpeg',
        },
        {
          buffer: makeBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          mimetype: 'image/png',
        },
      ];
      const req = { files };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject if any file is invalid', () => {
      const files = [
        {
          buffer: makeBuffer([0xff, 0xd8, 0xff]),
          mimetype: 'image/jpeg',
        },
        {
          buffer: makeBuffer([0x00, 0x01, 0x02]),
          mimetype: 'image/png',
        },
      ];
      const req = { files };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });

    it('should handle multer fields object format', () => {
      const files = {
        avatar: [
          {
            buffer: makeBuffer([0xff, 0xd8, 0xff]),
            mimetype: 'image/jpeg',
          },
        ],
        gallery: [
          {
            buffer: makeBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            mimetype: 'image/png',
          },
        ],
      };
      const req = { files };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Edge cases', () => {
    it('should pass through when no files', () => {
      const req = {};
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject file with no buffer', () => {
      const file = { mimetype: 'image/jpeg' };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });

    it('should reject too-short buffer', () => {
      const file = {
        buffer: makeBuffer([0xff]),
        mimetype: 'image/jpeg',
      };
      const req = { file };
      const next = vi.fn();
      validateImageSignature(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 415 }));
    });
  });
});
