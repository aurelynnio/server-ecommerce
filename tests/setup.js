/**
 * Vitest global test setup
 * Mocks external services to isolate tests from infrastructure
 */
import { vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '30m';
process.env.JWT_REFRESH_EXPIRES_IN = '16d';
process.env.BCRYPT_SALT_ROUNDS = '4';

// Mock Redis
vi.mock('../src/configs/redis.config', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
  },
}));

// Mock logger to suppress output during tests
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Socket.IO
vi.mock('../src/socket/index', () => ({
  getIO: vi.fn(() => ({ emit: vi.fn() })),
}));

// Mock Cloudinary
vi.mock('../src/configs/cloudinary', () => ({
  uploadImage: vi.fn().mockResolvedValue({ secure_url: 'https://cdn.test.com/image.jpg' }),
  multiUpload: vi.fn().mockResolvedValue([{ secure_url: 'https://cdn.test.com/image.jpg' }]),
}));

// Mock email service
vi.mock('../src/services/email.service', () => ({
  sendEmailVerificationCode: vi.fn().mockResolvedValue(true),
  sendPasswordResetCode: vi.fn().mockResolvedValue(true),
}));

// Mock embedding service
vi.mock('../src/services/embedding.service', () => ({
  embedProduct: vi.fn().mockResolvedValue(true),
  deleteProductEmbedding: vi.fn().mockResolvedValue(true),
}));
