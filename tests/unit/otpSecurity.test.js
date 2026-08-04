import { describe, expect, it, vi } from 'vitest';

const authService = require('../../src/services/auth.service');
const redisService = require('../../src/services/redis.service');

describe('OTP brute-force protection', () => {
  it('rejects and invalidates an OTP after five failed attempts', async () => {
    vi.spyOn(redisService, 'get').mockResolvedValue('123456');
    vi.spyOn(redisService, 'increment').mockResolvedValue(5);
    const del = vi.spyOn(redisService, 'del').mockResolvedValue();

    await expect(authService.ensureValidOtp('otp:test:user', '000000')).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(del).toHaveBeenCalledWith('otp:test:user');
    expect(del).toHaveBeenCalledWith('otp:test:user:attempts');

    vi.restoreAllMocks();
  });

  it('clears failed-attempt state after a valid OTP is used', async () => {
    vi.spyOn(redisService, 'get').mockResolvedValue('123456');
    const del = vi.spyOn(redisService, 'del').mockResolvedValue();

    await expect(authService.ensureValidOtp('otp:test:user', '123456')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith('otp:test:user:attempts');

    vi.restoreAllMocks();
  });
});
