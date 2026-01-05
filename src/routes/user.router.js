const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  updateProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  changePasswordValidator,
  createUserValidator,
  updateUserValidator,
  updateRoleValidator,
  updateUserByIdValidator,
  mongoIdParamValidator,
  addressIdParamValidator,
  paginationQueryValidator,
} = require("../validations/user.validator");
const upload = require("../configs/upload");

/**
 * Upload Routes
 */

/**
 * @route   POST /api/users/upload-avatar
 * @desc    Upload user avatar image
 * @access  Private (Authenticated users)
 */
router.post(
  "/upload-avatar",
  verifyAccessToken,
  upload.single("avatar"),
  userController.uploadAvatar
);

/**
 * Profile Routes
 */

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private (Authenticated users)
 */
router.get("/profile", verifyAccessToken, userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private (Authenticated users)
 * @body    { username?, email?, phone? }
 */
router.put(
  "/profile",
  verifyAccessToken,
  validate(updateProfileValidator),
  userController.updateProfile
);

/**
 * Address Routes
 */

/**
 * @route   POST /api/users/address
 * @desc    Add new address
 * @access  Private (Authenticated users)
 * @body    { fullName, phone, address, city, district, ward, isDefault? }
 */
router.post(
  "/address",
  verifyAccessToken,
  validate(addAddressValidator),
  userController.addAddress
);

/**
 * @route   PUT /api/users/address/:addressId
 * @desc    Update existing address
 * @access  Private (Authenticated users)
 */
router.put(
  "/address/:addressId",
  verifyAccessToken,
  validate({
    params: addressIdParamValidator,
    body: updateAddressValidator,
  }),
  userController.updateAddress
);

/**
 * @route   DELETE /api/users/address/:addressId
 * @desc    Delete address
 * @access  Private (Authenticated users)
 */
router.delete(
  "/address/:addressId",
  verifyAccessToken,
  validate({ params: addressIdParamValidator }),
  userController.deleteAddress
);

/**
 * @route   GET /api/users/address
 * @desc    Get all addresses for current user
 * @access  Private (Authenticated users)
 */
router.get("/address", verifyAccessToken, userController.getAddresses);

/**
 * @route   PUT /api/users/address/:addressId/default
 * @desc    Set address as default
 * @access  Private (Authenticated users)
 */
router.put(
  "/address/:addressId/default",
  verifyAccessToken,
  validate({ params: addressIdParamValidator }),
  userController.setDefaultAddress
);

/**
 * Password Management
 */

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private (Authenticated users)
 * @body    { oldPassword, newPassword }
 */
router.put(
  "/change-password",
  verifyAccessToken,
  validate(changePasswordValidator),
  userController.changePassword
);

/**
 * Admin Routes - User Management
 */

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination
 * @access  Private (Admin only)
 * @query   page, limit, search, role, isVerifiedEmail
 */
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: paginationQueryValidator }),
  userController.getAllUsers
);

/**
 * @route   POST /api/users/create
 * @desc    Create new user (Admin)
 * @access  Private (Admin only)
 * @body    { username, email, roles?, phone?, isVerifiedEmail? }
 */
router.post(
  "/create",
  verifyAccessToken,
  requireRole("admin"),
  validate(createUserValidator),
  userController.createUser
);

/**
 * @route   POST /api/users/update
 * @desc    Update user by ID (Admin)
 * @access  Private (Admin only)
 * @body    { id, username?, email?, roles?, isVerifiedEmail? }
 */
router.post(
  "/update",
  verifyAccessToken,
  requireRole("admin"),
  validate(updateUserValidator),
  userController.updateUser
);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Private (Admin only)
 * @body    { roles }
 */
router.put(
  "/:id/role",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: mongoIdParamValidator,
    body: updateRoleValidator,
  }),
  userController.updateUserRole
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: mongoIdParamValidator }),
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: mongoIdParamValidator,
    body: updateUserByIdValidator,
  }),
  userController.updateUserById
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: mongoIdParamValidator }),
  userController.deleteUser
);

module.exports = router;
