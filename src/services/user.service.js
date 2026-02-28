const userModel = require("../repositories/user.repository");
const hashPassword = require("../utils/hashPasword");
const comparePassword = require("../utils/comparePassword");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");

const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

/**
 * Service handling user management operations
 * Manages user creation, profile updates, and retrieval
 */
class UserService {
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
      roles = "user",
      phone,
      isVerifiedEmail = false,
      permissions = [],
    } = userData;

    // Check if username already exists
    const existingUsername = await userModel.findByUsername(username);
    if (existingUsername) {
      throw new ApiError(StatusCodes.CONFLICT, "Username already exists");
    }

    // Check if email already exists
    const existingEmail = await userModel.findByEmail(email);
    if (existingEmail) {
      throw new ApiError(StatusCodes.CONFLICT, "Email already exists");
    }

    if (!password) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Password is required");
    }

    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      roles,
      phone: phone || undefined,
      isVerifiedEmail,
      permissions,
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    return userResponse;
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
      { new: true, select: "-password" }
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
  }

  /**
   * Get user profile details
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile object
   * @throws {Error} If user not found
   */
  async getUserProfile(userId) {
    const user = await userModel.findByIdWithoutPassword(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
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
    // Check if username or email already exists
    if (data.username) {
      const existingUser = await userModel.findByUsernameExcludingId(
        data.username,
        userId,
      );
      if (existingUser) {
        throw new ApiError(StatusCodes.CONFLICT, "Username already exists");
      }
    }

    if (data.email) {
      const existingUser = await userModel.findByEmailExcludingId(
        data.email,
        userId,
      );
      if (existingUser) {
        throw new ApiError(StatusCodes.CONFLICT, "Email already exists");
      }
    }

    const user = await userModel.updateById(userId, data, {
      new: true,
      runValidators: true,
      select: "-password",
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
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
      { new: true, runValidators: true, select: "-password" }
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
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
    const user = await userModel.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
    }

    // Update only provided fields
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
    // Thá»±c hiá»‡n xÃ³a
    const userAfter = await userModel.updateById(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true, select: "-password" }
    );

    if (!userAfter) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return userAfter;
  }

  /**
   * Get all addresses for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's addresses
   * @throws {Error} If user not found
   */
  async getAddresses(userId) {
    const user = await userModel.findByIdWithAddresses(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

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
    const user = await userModel.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
    }

    // Reset all addresses to non-default
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    // Set the selected address as default
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
    const user = await userModel.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Verify old password
    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Old password is incorrect");
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return { message: "Password changed successfully" };
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
    const { page, limit, search = "", role, isVerifiedEmail } = query;
    const normalizedSearch = String(search || "").trim();
    if (normalizedSearch.length > 100) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Search query is too long"
      );
    }

    const filterArgs = {
      search: normalizedSearch,
      role,
      isVerifiedEmail,
    };
    const total = await userModel.countWithFilters(filterArgs);

    // Get pagination params with total count
    const paginationParams = getPaginationParams(page, limit, total);

    const users = await userModel.findWithFilters(
      filterArgs,
      paginationParams,
    );

    return buildPaginationResponse(users, paginationParams);

  }

  /**
   * Get user by ID (Admin)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User object without password
   * @throws {Error} If user not found
   */
  async getUserById(userId) {
    const user = await userModel.findByIdWithoutPassword(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
  }

  /**
   * Update user by ID (Admin)
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user object
   * @throws {Error} If user not found or username/email already exists
   */
  async updateUserById(userId, updateData) {
    // Check if user exists
    const user = await userModel.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Check if updating username and it already exists
    if (updateData.username && updateData.username !== user.username) {
      const existingUsername = await userModel.findByUsernameExcludingId(
        updateData.username,
        userId,
      );
      if (existingUsername) {
        throw new ApiError(StatusCodes.CONFLICT, "Username already exists");
      }
    }

    // Check if updating email and it already exists
    if (updateData.email && updateData.email !== user.email) {
      const existingEmail = await userModel.findByEmailExcludingId(
        updateData.email,
        userId,
      );
      if (existingEmail) {
        throw new ApiError(StatusCodes.CONFLICT, "Email already exists");
      }
    }

    // Update user
    const updatedUser = await userModel.updateById(userId, updateData, {
      new: true,
      runValidators: true,
      select: "-password",
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
      { new: true, runValidators: true, select: "-password" }
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
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
      { new: true, runValidators: true, select: "-password" }
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return user;
  }

  /**
   * Delete user permanently (Admin)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion confirmation message
   * @throws {Error} If user not found
   */
  async deleteUser(userId) {
    const user = await userModel.deleteById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    return { message: "User deleted successfully" };
  }
}

module.exports = new UserService();



