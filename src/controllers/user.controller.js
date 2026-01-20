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

* @access  Private (Admin)




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

* @access  Private (Admin)



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

* @access  Private (requires authentication)


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

* @access  Private (requires authentication)

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

* @access  Private (requires authentication)



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

* @access  Private (requires authentication)


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

* @access  Private (requires authentication)



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

* @access  Private (requires authentication)


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

* @access  Private (requires authentication)

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

* @access  Private (requires authentication)



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

* @access  Private (Admin)





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

* @access  Private (Admin)


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

* @access  Private (Admin)



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

* @access  Private (Admin)



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

* @access  Private (Admin)



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

* @access  Private (Admin)


   */
  deleteUser: catchAsync(async (req, res) => {
    const result = await userService.deleteUser(req.params.id);
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),
};

module.exports = UserController;
