const userModel = require('../repositories/user.repository');
const { hashPassword, comparePassword } = require('../utils/password.util');
const { getPaginationParams, buildPaginationResponse } = require('../utils/pagination');
const { uploadImage } = require('../configs/cloudinary');

const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { ensureFound } = require('../utils/serviceAssertions');

/**
 * Service handling user management operations
 * Manages user creation, profile updates, and retrieval
 */
class UserService {
  _sanitizeUserResponse(user) {
    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse;
  }

  _ensureUserFound(user) {
    return ensureFound(user, 'User not found');
  }

  async _ensureUniqueUsername(username, excludeUserId = null) {
    if (!username) return;

    const existingUser = excludeUserId
      ? await userModel.findByUsernameExcludingId(username, excludeUserId)
      : await userModel.findByUsername(username);

    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username already exists');
    }
  }

  async _ensureUniqueEmail(email, excludeUserId = null) {
    if (!email) return;

    const existingUser = excludeUserId
      ? await userModel.findByEmailExcludingId(email, excludeUserId)
      : await userModel.findByEmail(email);

    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already exists');
    }
  }

  /**
   * Create a new user (Admin function)
   * @param {Object} userData - User details
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @param {string} userData.password - Password
   * @param {string} [userData.roles="user"] - User role
   * @param {string} [userData.phone] - Phone number
   * @param {boolean} [userData.isVerifiedEmail=false] - Email verification status
   * @param {Array} [userData.permissions=[]] - User permissions
   * @returns {Promise<Object>} Created user object (without password)
   * @throws {Error} If username or email already exists
   */
  async createUser(userData) {
    const {
      username,
      email,
      password,
      roles = 'user',
      phone,
      isVerifiedEmail = false,
      permissions = [],
    } = userData;

    await this._ensureUniqueUsername(username);
    await this._ensureUniqueEmail(email);

    if (!password) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is required');
    }

    const hashedPassword = await hashPassword(password);

    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      roles,
      phone: phone || undefined,
      isVerifiedEmail,
      permissions,
    });

    return this._sanitizeUserResponse(user);
  }

  /**
   * Update user avatar URL
   * @param {string} userId - User ID
   * @param {string} url - New avatar URL
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found
   */
  async uploadAvatar(userId, url) {
    const user = await userModel.updateById(
      userId,
      { avatar: url },
      { new: true, select: '-password' },
    );

    return this._ensureUserFound(user);
  }

  /**
   * Upload avatar image to Cloudinary and update user profile
   * @param {string} userId - User ID
   * @param {Buffer} fileBuffer - Image file buffer
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If upload fails or user not found
   */
  async uploadAvatarImage(userId, fileBuffer) {
    const result = await uploadImage(fileBuffer, 'avatar');
    if (!result) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Image upload failed');
    }

    return this.uploadAvatar(userId, result.secure_url);
  }

  /**
   * Get user profile details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile object
   * @throws {Error} If user not found
   */
  async getUserProfile(userId) {
    return this._ensureUserFound(await userModel.findByIdWithoutPassword(userId));
  }

  /**
   * Update user profile information
   * @param {string} userId - User ID
   * @param {Object} data - Data to update
   * @param {string} [data.username] - New username
   * @param {string} [data.email] - New email
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If username or email already exists
   */
  async updateProfile(userId, data) {
    await this._ensureUniqueUsername(data.username, userId);
    await this._ensureUniqueEmail(data.email, userId);

    const user = await userModel.updateById(userId, data, {
      new: true,
      runValidators: true,
      select: '-password',
    });

    return this._ensureUserFound(user);
  }

  /**
   * Add a new address to user's address book
   * @param {string} userId - User ID
   * @param {Object} addressData - Address details
   * @returns {Promise<Object>} Updated user with new address
   * @throws {Error} If user not found
   */
  async addAddress(userId, addressData) {
    const user = await userModel.updateById(
      userId,
      { $push: { addresses: addressData } },
      { new: true, runValidators: true, select: '-password' },
    );

    return this._ensureUserFound(user);
  }

  /**
   * Update an existing address
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID to update
   * @param {Object} addressData - New address data
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user or address not found
   */
  async updateAddress(userId, addressId, addressData) {
    const user = this._ensureUserFound(await userModel.findById(userId));

    const address = user.addresses.id(addressId);
    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Address not found');
    }

    Object.keys(addressData).forEach((key) => {
      if (addressData[key] !== undefined) {
        address[key] = addressData[key];
      }
    });

    await user.save();
    const userObj = user.toObject({ transform: true, versionKey: false });
    delete userObj.password;
    return userObj;
  }

  /**
   * Delete an address from user's address book
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID to delete
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found
   */
  async deleteAddress(userId, addressId) {
    const userAfter = await userModel.updateById(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true, select: '-password' },
    );

    return this._ensureUserFound(userAfter);
  }

  /**
   * Get all addresses for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's addresses
   * @throws {Error} If user not found
   */
  async getAddresses(userId) {
    const user = this._ensureUserFound(await userModel.findByIdWithAddresses(userId));
    return user.addresses;
  }

  /**
   * Set an address as the default address
   * @param {string} userId - User ID
   * @param {string} addressId - Address ID to set as default
   * @returns {Promise<Array>} Updated addresses array
   * @throws {Error} If user or address not found
   */
  async setDefaultAddress(userId, addressId) {
    const user = this._ensureUserFound(await userModel.findById(userId));

    const address = user.addresses.id(addressId);
    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Address not found');
    }

    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    address.isDefault = true;

    await user.save();

    return user.addresses;
  }

  /**
   * Change user's password
   * @param {string} userId - User ID
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   * @throws {Error} If user not found or old password incorrect
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = this._ensureUserFound(await userModel.findById(userId));

    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Old password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  /**
   * Get all users with pagination and filtering (Admin)
   * @param {Object} query - Query parameters
   * @param {number} query.page - Page number
   * @param {number} query.limit - Items per page
   * @param {string} [query.search] - Search by username or email
   * @param {string} [query.role] - Filter by role
   * @param {boolean} [query.isVerifiedEmail] - Filter by email verification status
   * @returns {Promise<Object>} Users with pagination metadata
   */
  async getAllUsers(query) {
    const { page, limit, search = '', role, isVerifiedEmail } = query;
    const normalizedSearch = String(search || '').trim();
    if (normalizedSearch.length > 100) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Search query is too long');
    }

    const filterArgs = {
      search: normalizedSearch,
      role,
      isVerifiedEmail,
    };
    const total = await userModel.countWithFilters(filterArgs);

    const paginationParams = getPaginationParams(page, limit, total);

    const users = await userModel.findWithFilters(filterArgs, paginationParams);
    const statisticsResult = await userModel.aggregateStatisticsWithFilters(filterArgs);
    const statisticsFacet = statisticsResult?.[0] || {};

    const statistics = {
      totalUsers: statisticsFacet.totalUsers?.[0]?.count || 0,
      verifiedUsers: statisticsFacet.verifiedUsers?.[0]?.count || 0,
      usersWithAddress: statisticsFacet.usersWithAddress?.[0]?.count || 0,
      recentUsers: statisticsFacet.recentUsers?.[0]?.count || 0,
    };

    return {
      ...buildPaginationResponse(users, paginationParams),
      statistics,
    };
  }

  /**
   * Get user by ID (Admin)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User object without password
   * @throws {Error} If user not found
   */
  async getUserById(userId) {
    return this._ensureUserFound(await userModel.findByIdWithoutPassword(userId));
  }

  /**
   * Update user by ID (Admin)
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found or username/email already exists
   */
  async updateUserById(userId, updateData) {
    const user = this._ensureUserFound(await userModel.findById(userId));

    if (updateData.username && updateData.username !== user.username) {
      await this._ensureUniqueUsername(updateData.username, userId);
    }

    if (updateData.email && updateData.email !== user.email) {
      await this._ensureUniqueEmail(updateData.email, userId);
    }

    const updatedUser = await userModel.updateById(userId, updateData, {
      new: true,
      runValidators: true,
      select: '-password',
    });

    return updatedUser;
  }

  /**
   * Update user role (Admin)
   * @param {string} userId - User ID
   * @param {string} roles - New role
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found
   */
  async updateUserRole(userId, roles) {
    const user = await userModel.updateById(
      userId,
      { roles },
      { new: true, runValidators: true, select: '-password' },
    );

    return this._ensureUserFound(user);
  }

  /**
   * Update user permissions (Admin)
   * @param {string} userId - User ID
   * @param {Array} permissions - New permissions array
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found
   */
  async updateUserPermissions(userId, permissions) {
    const user = await userModel.updateById(
      userId,
      { permissions },
      { new: true, runValidators: true, select: '-password' },
    );

    return this._ensureUserFound(user);
  }

  /**
   * Delete user permanently (Admin)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion confirmation message
   * @throws {Error} If user not found
   */
  async deleteUser(userId) {
    this._ensureUserFound(await userModel.deleteById(userId));

    return { message: 'User deleted successfully' };
  }
}

module.exports = new UserService();
