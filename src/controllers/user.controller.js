const catchAsync = require("../configs/catchAsync");
const { uploadImage } = require("../configs/cloudinary");
const userService = require("../services/user.service");
const { sendFail, sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");

/**
 * User Controller
 * Handles user profile, addresses, and admin user management
 */
const UserController = {
  /**
   * Create a new user (Admin only)
   * @route POST /api/users
   * @access Private (Admin)
   * @body {string} username - Username
   * @body {string} email - Email address
   * @body {string} [roles] - User role
   * @returns {Object} Created user
   */
  createUser: catchAsync(async (req, res) => {
    const user = await userService.createUser(req.body);
    return sendSuccess(
      res,
      user,
      "User created successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Update user by ID (Admin only)
   * @route PUT /api/users/:id
   * @access Private (Admin)
   * @param {string} id - User ID in body
   * @body {Object} updateData - Fields to update
   * @returns {Object} Updated user
   */
  updateUser: catchAsync(async (req, res) => {
    // Extract id from validated data
    const { id, ...updateData } = req.body;

    // Check if there's data to update
    if (!updateData || Object.keys(updateData).length === 0) {
      return sendFail(
        res,
        "No data provided for update",
        StatusCodes.BAD_REQUEST
      );
    }

    const user = await userService.updateUserById(id, updateData);
    return sendSuccess(res, user, "User updated successfully", StatusCodes.OK);
  }),

  /**
   * Upload user avatar
   * @route POST /api/users/avatar
   * @access Private (requires authentication)
   * @files {File} avatar - Avatar image file
   * @returns {Object} Updated user with new avatar URL
   */
  uploadAvatar: catchAsync(async (req, res) => {
    const file = req.file;
    const userId = req.user.userId;

    if (!file) {
      return sendFail(res, "No file uploaded", StatusCodes.BAD_REQUEST);
    }

    const result = await uploadImage(file.buffer, "avatar");
    if (!result) {
      return sendFail(
        res,
        "Image upload failed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const user = await userService.uploadAvatar(userId, result.secure_url);
    return sendSuccess(
      res,
      user,
      "Avatar uploaded successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get current user's profile
   * @route GET /api/users/profile
   * @access Private (requires authentication)
   * @returns {Object} User profile
   */
  getProfile: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.getUserProfile(userId);
    return sendSuccess(
      res,
      user,
      "Profile retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update current user's profile
   * @route PUT /api/users/profile
   * @access Private (requires authentication)
   * @body {string} [username] - New username
   * @body {string} [email] - New email
   * @returns {Object} Updated user profile
   */
  updateProfile: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.updateProfile(userId, req.body);
    return sendSuccess(
      res,
      user,
      "Profile updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Add a new address to user's address book
   * @route POST /api/users/address
   * @access Private (requires authentication)
   * @body {Object} addressData - Address details
   * @returns {Object} Updated user with new address
   */
  addAddress: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.addAddress(userId, req.body);
    return sendSuccess(
      res,
      user,
      "Address added successfully",
      StatusCodes.CREATED
    );
  }),

  /**
   * Update an existing address
   * @route PUT /api/users/address/:addressId
   * @access Private (requires authentication)
   * @param {string} addressId - Address ID
   * @body {Object} addressData - Updated address details
   * @returns {Object} Updated user
   */
  updateAddress: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.updateAddress(
      userId,
      req.params.addressId,
      req.body
    );
    return sendSuccess(
      res,
      user,
      "Address updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete an address from user's address book
   * @route DELETE /api/users/address/:addressId
   * @access Private (requires authentication)
   * @param {string} addressId - Address ID
   * @returns {Object} Updated user
   */
  deleteAddress: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.deleteAddress(userId, req.params.addressId);
    if (!user) {
      throw new Error("Error")
    }
    return sendSuccess(
      res,
      user,
      "Address deleted successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get all user's addresses
   * @route GET /api/users/address
   * @access Private (requires authentication)
   * @returns {Array} User's addresses
   */
  getAddresses: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const addresses = await userService.getAddresses(userId);
    return sendSuccess(
      res,
      addresses,
      "Addresses retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Set an address as the default address
   * @route PUT /api/users/address/:addressId/default
   */
  setDefaultAddress: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const addresses = await userService.setDefaultAddress(
      userId,
      req.params.addressId
    );
    return sendSuccess(
      res,
      addresses,
      "Default address set successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Change user's password
   * @route PUT /api/users/change-password
   * @access Private (requires authentication)
   * @body {string} oldPassword - Current password
   * @body {string} newPassword - New password
   * @returns {Object} Success message
   */
  changePassword: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const result = await userService.changePassword(
      userId,
      req.body.oldPassword,
      req.body.newPassword
    );
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),

  /**
   * Get all users with pagination (Admin only)
   * @route GET /api/users
   * @access Private (Admin)
   * @query {number} [page] - Page number
   * @query {number} [limit] - Items per page
   * @query {string} [search] - Search by username or email
   * @query {string} [role] - Filter by role
   * @returns {Object} Users with pagination
   */
  getAllUsers: catchAsync(async (req, res) => {
    const result = await userService.getAllUsers(req.query);
    return sendSuccess(
      res,
      result,
      "Users retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get user by ID (Admin only)
   * @route GET /api/users/:id
   * @access Private (Admin)
   * @param {string} id - User ID
   * @returns {Object} User object
   */
  getUserById: catchAsync(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(
      res,
      user,
      "User retrieved successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update user by ID (Admin only)
   * @route PUT /api/users/:id
   * @access Private (Admin)
   * @param {string} id - User ID
   * @body {Object} updateData - Fields to update
   * @returns {Object} Updated user
   */
  updateUserById: catchAsync(async (req, res) => {
    const bodyValue = req.body;

    // Check if there's data to update
    if (!bodyValue || Object.keys(bodyValue).length === 0) {
      return sendFail(
        res,
        "No data provided for update",
        StatusCodes.BAD_REQUEST
      );
    }

    const user = await userService.updateUserById(req.params.id, bodyValue);
    return sendSuccess(res, user, "User updated successfully", StatusCodes.OK);
  }),

  /**
   * Update user role (Admin only)
   * @route PUT /api/users/:id/role
   * @access Private (Admin)
   * @param {string} id - User ID
   * @body {string} roles - New role
   * @returns {Object} Updated user
   */
  updateUserRole: catchAsync(async (req, res) => {
    const user = await userService.updateUserRole(req.params.id, req.body.roles);
    return sendSuccess(
      res,
      user,
      "User role updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Update user permissions (Admin only)
   * @route PUT /api/users/:id/permissions
   * @access Private (Admin)
   * @param {string} id - User ID
   * @body {Array} permissions - New permissions array
   * @returns {Object} Updated user
   */
  updateUserPermissions: catchAsync(async (req, res) => {
    const user = await userService.updateUserPermissions(
      req.params.id,
      req.body.permissions
    );
    return sendSuccess(
      res,
      user,
      "User permissions updated successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Delete user (Admin only)
   * @route DELETE /api/users/:id
   * @access Private (Admin)
   * @param {string} id - User ID
   * @returns {Object} Deletion confirmation
   */
  deleteUser: catchAsync(async (req, res) => {
    const result = await userService.deleteUser(req.params.id);
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),
};

module.exports = UserController;
