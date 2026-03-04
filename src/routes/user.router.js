const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyAccessToken, requireRole } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  updateProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  createUserValidator,
  updateUserValidator,
  updateRoleValidator,
  updateUserByIdValidator,
  mongoIdParamValidator,
  addressIdParamValidator,
  paginationQueryValidator,
  changePasswordValidator,
} = require('../validations/user.validator');
const upload = require('../configs/upload');
const { validateImageSignature } = require('../middlewares/uploadSignature.middleware');

/**
 * @desc    Upload user avatar image
 * @access  Private
 */
router.post(
  '/upload-avatar',
  verifyAccessToken,
  upload.single('avatar'),
  validateImageSignature,
  userController.uploadAvatar,
);

/**
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/profile', verifyAccessToken, userController.getProfile);

/**
 * @desc    Update current user's profile
 * @access  Private
 */
router.put(
  '/profile',
  verifyAccessToken,
  validate(updateProfileValidator),
  userController.updateProfile,
);

/**
 * @desc    Add new address
 * @access  Private
 */
router.post(
  '/addresses',
  verifyAccessToken,
  validate(addAddressValidator),
  userController.addAddress,
);

/**
 * @desc    Update existing address
 * @access  Private
 */
router.put(
  '/addresses/:addressId',
  verifyAccessToken,
  validate({
    params: addressIdParamValidator,
    body: updateAddressValidator,
  }),
  userController.updateAddress,
);

/**
 * @desc    Delete address
 * @access  Private
 */
router.delete(
  '/addresses/:addressId',
  verifyAccessToken,
  validate({ params: addressIdParamValidator }),
  userController.deleteAddress,
);

/**
 * @desc    Get all addresses for current user
 * @access  Private
 */
router.get('/addresses', verifyAccessToken, userController.getAddresses);

/**
 * @desc    Set address as default
 * @access  Private
 */
router.put(
  '/addresses/:addressId/default',
  verifyAccessToken,
  validate({ params: addressIdParamValidator }),
  userController.setDefaultAddress,
);

/**
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/change-password',
  verifyAccessToken,
  validate(changePasswordValidator),
  userController.changePassword,
);

/**
 * @desc    Get all users with pagination
 * @access  Private (Admin)
 */
router.get(
  '/',
  verifyAccessToken,
  requireRole('admin'),
  validate({ query: paginationQueryValidator }),
  userController.getAllUsers,
);

/**
 * @desc    Create new user (Admin)
 * @access  Private (Admin)
 */
router.post(
  '/',
  verifyAccessToken,
  requireRole('admin'),
  validate(createUserValidator),
  userController.createUser,
);

/**
 * @desc    Update user by ID (Admin)
 * @access  Private (Admin)
 */
router.put(
  '/',
  verifyAccessToken,
  requireRole('admin'),
  validate(updateUserValidator),
  userController.updateUser,
);

/**
 * @desc    Update user by ID
 * @access  Private (Admin)
 * @param   id - User ID
 */
router.put(
  '/:id',
  verifyAccessToken,
  requireRole('admin'),
  validate({
    params: mongoIdParamValidator,
    body: updateUserByIdValidator,
  }),
  userController.updateUserById,
);

/**
 * @desc    Update user role
 * @access  Private (Admin)
 */
router.put(
  '/:id/role',
  verifyAccessToken,
  requireRole('admin'),
  validate({
    params: mongoIdParamValidator,
    body: updateRoleValidator,
  }),
  userController.updateUserRole,
);

/**
 * @desc    Get user by ID
 * @access  Private (Admin)
 */
router.get(
  '/:id',
  verifyAccessToken,
  requireRole('admin'),
  validate({ params: mongoIdParamValidator }),
  userController.getUserById,
);

/**
 * @desc    Delete user
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  verifyAccessToken,
  requireRole('admin'),
  validate({ params: mongoIdParamValidator }),
  userController.deleteUser,
);

module.exports = router;
