/**
 * Unit Tests: User Profile Endpoints & Methods
 * Tests getAddressById, deleteAvatar, getUserStats, deleteOwnAccount, and updated validations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';

const validUserId = '507f1f77bcf86cd799439011';
const validAddressId = '507f1f77bcf86cd799439022';

const userRepo = require('../../src/repositories/user.repository');
const orderRepo = require('../../src/repositories/order.repository');
const wishlistRepo = require('../../src/repositories/wishlist.repository');
const userSavedVoucherRepo = require('../../src/repositories/user-saved-voucher.repository');
const notificationRepo = require('../../src/repositories/notification.repository');
const passwordUtil = require('../../src/utils/password.util');
const userService = require('../../src/services/user.service');
const userController = require('../../src/controllers/user.controller');
const {
  updateProfileValidator,
  deleteAccountValidator,
  updatePermissionsValidator,
} = require('../../src/validations/user.validator');

describe('User Profile Enhanced Endpoints & Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('userService.getAddressById', () => {
    it('should return address when address exists', async () => {
      const mockAddress = {
        _id: validAddressId,
        fullName: 'Nguyen Van A',
        phone: '0912345678',
        address: '123 Le Loi',
        city: 'Ha Noi',
        district: 'Ba Dinh',
        ward: 'Dien Bien',
        isDefault: true,
      };

      const mockUser = {
        _id: validUserId,
        addresses: {
          id: vi.fn((id) => (id === validAddressId ? mockAddress : null)),
        },
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);

      const result = await userService.getAddressById(validUserId, validAddressId);
      expect(result).toEqual(mockAddress);
      expect(mockUser.addresses.id).toHaveBeenCalledWith(validAddressId);
    });

    it('should throw 404 when address is not found in user addresses', async () => {
      const mockUser = {
        _id: validUserId,
        addresses: {
          id: vi.fn().mockReturnValue(null),
        },
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);

      await expect(userService.getAddressById(validUserId, 'nonexistent')).rejects.toThrow(
        'Address not found',
      );
    });

    it('should throw 404 when user is not found', async () => {
      vi.spyOn(userRepo, 'findById').mockResolvedValue(null);

      await expect(userService.getAddressById(validUserId, validAddressId)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('userService.deleteAvatar', () => {
    it('should set avatar to null and return sanitized user', async () => {
      const mockUpdatedUser = {
        _id: validUserId,
        username: 'testuser',
        email: 'test@example.com',
        avatar: null,
      };

      vi.spyOn(userRepo, 'updateById').mockResolvedValue(mockUpdatedUser);

      const result = await userService.deleteAvatar(validUserId);
      expect(userRepo.updateById).toHaveBeenCalledWith(
        validUserId,
        { avatar: null },
        { new: true, select: '-password' },
      );
      expect(result.avatar).toBeNull();
    });

    it('should throw 404 when user does not exist', async () => {
      vi.spyOn(userRepo, 'updateById').mockResolvedValue(null);

      await expect(userService.deleteAvatar(validUserId)).rejects.toThrow('User not found');
    });
  });

  describe('userService.getUserStats', () => {
    it('should return aggregated profile statistics', async () => {
      const mockUser = {
        _id: validUserId,
        addresses: [{ _id: validAddressId }, { _id: 'addr2' }],
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);
      vi.spyOn(orderRepo, 'countAllWithFilters').mockImplementation(({ status }) =>
        Promise.resolve(status === 'pending' ? 2 : 7),
      );
      vi.spyOn(wishlistRepo, 'countByUserId').mockResolvedValue(5);
      vi.spyOn(userSavedVoucherRepo, 'countByUserId').mockResolvedValue(3);
      vi.spyOn(notificationRepo, 'countUnreadByUserId').mockResolvedValue(4);

      const result = await userService.getUserStats(validUserId);

      expect(result).toEqual({
        orders: { total: 7, pending: 2 },
        wishlist: { total: 5 },
        vouchers: { saved: 3 },
        notifications: { unread: 4 },
        addresses: { total: 2 },
      });
    });
  });

  describe('userService.deleteOwnAccount', () => {
    it('should delete account successfully for local user with correct password', async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('mypassword', 10);

      const mockUser = {
        _id: validUserId,
        provider: 'local',
        password: hashedPassword,
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);
      vi.spyOn(userRepo, 'deleteById').mockResolvedValue(mockUser);

      const result = await userService.deleteOwnAccount(validUserId, 'mypassword');
      expect(userRepo.deleteById).toHaveBeenCalledWith(validUserId);
      expect(result.message).toBe('Account deleted successfully');
    });

    it('should reject with 400 when password is incorrect for local user', async () => {
      const mockUser = {
        _id: validUserId,
        provider: 'local',
        password: 'hashed_mypassword',
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);
      vi.spyOn(userRepo, 'deleteById').mockResolvedValue(mockUser);
      vi.spyOn(passwordUtil, 'comparePassword').mockResolvedValue(false);

      await expect(userService.deleteOwnAccount(validUserId, 'wrongpassword')).rejects.toThrow(
        'Password is incorrect',
      );
      expect(userRepo.deleteById).not.toHaveBeenCalled();
    });

    it('should delete account for OAuth (google) user without requiring password', async () => {
      const mockUser = {
        _id: validUserId,
        provider: 'google',
        password: null,
      };

      vi.spyOn(userRepo, 'findById').mockResolvedValue(mockUser);
      vi.spyOn(userRepo, 'deleteById').mockResolvedValue(mockUser);

      const result = await userService.deleteOwnAccount(validUserId);
      expect(userRepo.deleteById).toHaveBeenCalledWith(validUserId);
      expect(result.message).toBe('Account deleted successfully');
    });
  });

  describe('Profile Validation Enhancements', () => {
    it('should validate updateProfile with fullName, phone, gender, dateOfBirth', () => {
      const validPayload = {
        username: 'new_username',
        fullName: 'Tran Van B',
        phone: '0987654321',
        gender: 'male',
        dateOfBirth: '1995-05-15',
      };

      const { error, value } = updateProfileValidator.validate(validPayload);
      expect(error).toBeUndefined();
      expect(value.fullName).toBe('Tran Van B');
      expect(value.gender).toBe('male');
    });

    it('should reject invalid phone format in updateProfile', () => {
      const invalidPayload = {
        phone: '12345',
      };

      const { error } = updateProfileValidator.validate(invalidPayload);
      expect(error).toBeDefined();
    });

    it('should reject invalid gender option in updateProfile', () => {
      const invalidPayload = {
        gender: 'unknown_gender',
      };

      const { error } = updateProfileValidator.validate(invalidPayload);
      expect(error).toBeDefined();
    });

    it('should validate deleteAccountValidator with optional password', () => {
      expect(deleteAccountValidator.validate({ password: 'secret' }).error).toBeUndefined();
      expect(deleteAccountValidator.validate({}).error).toBeUndefined();
    });

    it('should validate updatePermissionsValidator requiring an array of strings', () => {
      expect(
        updatePermissionsValidator.validate({ permissions: ['order:read', 'user:update'] }).error,
      ).toBeUndefined();
      expect(updatePermissionsValidator.validate({ permissions: 'invalid' }).error).toBeDefined();
    });
  });

  describe('userController Handlers', () => {
    const createMockReqRes = (overrides = {}) => {
      const req = {
        user: { userId: validUserId, id: validUserId },
        params: {},
        body: {},
        ...overrides,
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      return { req, res };
    };

    it('deleteAvatar handler should send success response', async () => {
      const { req, res } = createMockReqRes();
      vi.spyOn(userService, 'deleteAvatar').mockResolvedValue({ _id: validUserId, avatar: null });

      await userController.deleteAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Avatar deleted successfully',
        }),
      );
    });

    it('getAddressById handler should return target address', async () => {
      const { req, res } = createMockReqRes({ params: { addressId: validAddressId } });
      vi.spyOn(userService, 'getAddressById').mockResolvedValue({ _id: validAddressId, city: 'Hanoi' });

      await userController.getAddressById(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: { _id: validAddressId, city: 'Hanoi' },
        }),
      );
    });

    it('getUserStats handler should return dashboard stats', async () => {
      const { req, res } = createMockReqRes();
      const mockStats = { orders: { total: 5, pending: 1 } };
      vi.spyOn(userService, 'getUserStats').mockResolvedValue(mockStats);

      await userController.getUserStats(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockStats,
        }),
      );
    });

    it('deleteOwnAccount handler should return success message', async () => {
      const { req, res } = createMockReqRes({ body: { password: 'pass' } });
      vi.spyOn(userService, 'deleteOwnAccount').mockResolvedValue({
        message: 'Account deleted successfully',
      });

      await userController.deleteOwnAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Account deleted successfully',
        }),
      );
    });
  });
});
