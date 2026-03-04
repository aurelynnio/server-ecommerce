const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { authLimiter, sensitiveLimiter } = require('../middlewares/rateLimited.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  loginValidator,
  registerValidator,
  sendVerificationCodeValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
} = require('../validations/auth.validator');

/**
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, validate(registerValidator), authController.register);

/**
 * @desc    Login user and return tokens in cookies
 * @access  Public
 */
router.post('/login', authLimiter, validate(loginValidator), authController.login);

/**
 * @desc    Send verification code to email (new or resend)
 * @access  Public
 */
router.post(
  '/send-verification-code',
  sensitiveLimiter,
  validate(sendVerificationCodeValidator),
  authController.sendVerificationCode,
);

/**
 * @desc    Verify email with 6-digit code
 * @access  Public
 */
router.post(
  '/verify-code',
  sensitiveLimiter,
  validate(verifyEmailValidator),
  authController.verifyEmail,
);

/**
 * @desc    Request password reset code
 * @access  Public
 */
router.post(
  '/forgot-password',
  sensitiveLimiter,
  validate(forgotPasswordValidator),
  authController.forgotPassword,
);

/**
 * @desc    Reset password with code
 * @access  Public
 */
router.post(
  '/reset-password',
  sensitiveLimiter,
  validate(resetPasswordValidator),
  authController.resetPassword,
);

/**
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @desc    Logout user and clear cookies
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post(
  '/change-password',
  verifyAccessToken,
  validate(changePasswordValidator),
  authController.changePassword,
);

module.exports = router;
