const catchAsync = require("../configs/catchAsync");
const { uploadImage } = require("../configs/cloudinary");
const userService = require("../services/user.service");
const { sendFail, sendSuccess } = require("../shared/res/formatResponse");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

const UserController = {
  /**
   * Create user
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update user
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateUser: catchAsync(async (req, res) => {
    const { id, ...updateData } = req.body;

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
   * Upload avatar
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Get profile
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update profile
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Add address
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update address
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Delete address
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteAddress: catchAsync(async (req, res) => {
    const userId = req.user.userId;
    const user = await userService.deleteAddress(userId, req.params.addressId);
    if (!user) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Delete address failed");
    }
    return sendSuccess(
      res,
      user,
      "Address deleted successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Get addresses
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Set default address
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Change password
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Get all users
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Get user by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update user by id
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  updateUserById: catchAsync(async (req, res) => {
    const bodyValue = req.body;

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
   * Update user role
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Update user permissions
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Delete user
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  deleteUser: catchAsync(async (req, res) => {
    const result = await userService.deleteUser(req.params.id);
    return sendSuccess(res, result, result.message, StatusCodes.OK);
  }),
};

module.exports = UserController;
