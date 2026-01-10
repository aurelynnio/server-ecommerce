const catchAsync = require("../configs/catchAsync");
const authService = require("../services/auth.service");
const { sendFail, sendSuccess } = require("../shared/res/formatResponse");

const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");

/**
 * Authentication Controller
 * Handles user registration, login, password management, and token operations
 */
const AuthController = {
  /**
   * Register a new user
   * @route POST /api/auth/register
   * @access Public
   * @body {string} username - User's username
   * @body {string} email - User's email
   * @body {string} password - User's password
   * @returns {Object} Created user object
   */
  register: catchAsync(async (req, res) => {
    const result = await authService.register(req.body);
    return sendSuccess(
      res,
      result,
      "Registration successful. Please verify your email.",
      StatusCodes.CREATED
    );
  }),

  /**
   * Authenticate user and return tokens
   * @route POST /api/auth/login
   * @access Public
   * @body {string} email - User's email
   * @body {string} password - User's password
   * @returns {Object} User info with access and refresh tokens
   */
  login: catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    const { accessToken, refreshToken, user } = result;

    // Set refresh token in HTTP-only cookie (long-lived)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Không thể truy cập từ JavaScript
      secure: process.env.NODE_ENV === "production", // Chỉ gửi qua HTTPS trong production
      sameSite: "strict", // CSRF protection
      maxAge: 16 * 24 * 60 * 60 * 1000, // 16 days
    });

    // Set access token in HTTP-only cookie (short-lived)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1 * 60 * 1000, // 1 minute
    });

    return sendSuccess(
      res,
      { ...user, accessToken, refreshToken },
      "Login successful",
      StatusCodes.OK
    );
  }),

  /**
   * Send email verification code
   * @route POST /api/auth/send-verification
   * @access Public
   * @body {string} email - User's email
   * @returns {Object} Success message with expiration info
   */
  sendVerificationCode: catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await authService.sendVerificationCode(email);
    return sendSuccess(
      res,
      result,
      "Verification code sent successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Verify email with verification code
   * @route POST /api/auth/verify-email
   * @access Public
   * @body {string} code - 6-digit verification code
   * @returns {Object} Verified user object
   */
  verifyEmail: catchAsync(async (req, res) => {
    const { code } = req.body;
    const result = await authService.verifyEmailByCode(code);
    return sendSuccess(
      res,
      result.user,
      "Email verified successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Request password reset (forgot password)
   * @route POST /api/auth/forgot-password
   * @access Public
   * @body {string} email - User's email
   * @returns {Object} Success message
   */
  forgotPassword: catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return sendSuccess(
      res,
      result,
      "Password reset code sent to your email",
      StatusCodes.OK
    );
  }),

  /**
   * Reset password with verification code
   * @route POST /api/auth/reset-password
   * @access Public
   * @body {string} email - User's email
   * @body {string} code - Reset verification code
   * @body {string} newPassword - New password
   * @returns {Object} Success message
   */
  resetPassword: catchAsync(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const result = await authService.resetPassword(email, code, newPassword);
    return sendSuccess(
      res,
      result,
      "Password reset successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Refresh access token using refresh token
   * @route POST /api/auth/refresh-token
   * @access Public (requires valid refresh token)
   * @cookie refreshToken - HTTP-only refresh token
   * @body {string} [refreshToken] - Fallback refresh token in body
   * @returns {Object} New access token
   */
  refreshToken: catchAsync(async (req, res) => {
    // Lấy refresh token từ cookie (ưu tiên) hoặc body (fallback)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return sendFail(
        res,
        "Refresh token is required",
        StatusCodes.BAD_REQUEST
      );
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return sendFail(
        res,
        "Invalid or expired refresh token",
        StatusCodes.UNAUTHORIZED
      );
    }

    // Get user from database to get fresh permissions
    const User = require("../models/user.model");
    const user = await User.findById(payload.userId).lean();
    
    if (!user) {
      return sendFail(res, "User not found", StatusCodes.UNAUTHORIZED);
    }

    // Get fresh permissions
    const permissionService = require("../services/permission.service");
    const permissions = permissionService.getUserPermissions(user);

    // Generate new access token with fresh permissions
    const tokenService = require("../services/token.service");
    const newPayload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.roles,
      permissions: permissions,
    };
    const newAccessToken = tokenService.generateAccessToken(newPayload);

    // Set access token mới vào cookie (refresh token cookie giữ nguyên)
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    return sendSuccess(
      res,
      { accessToken: newAccessToken, permissions },
      "Access token refreshed successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Logout user and clear tokens
   * @route POST /api/auth/logout
   * @access Private (requires authentication)
   * @returns {Object} Success message
   */
  logout: catchAsync(async (req, res) => {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return sendSuccess(res, null, "Logged out successfully", StatusCodes.OK);
  }),

  /**
   * Change password for authenticated user
   * @route POST /api/auth/change-password
   * @access Private (requires authentication)
   * @body {string} currentPassword - Current password
   * @body {string} newPassword - New password
   * @returns {Object} Success message
   */
  changePassword: catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendFail(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
    }

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword
    );
    return sendSuccess(
      res,
      result,
      "Password changed successfully",
      StatusCodes.OK
    );
  }),
};

module.exports = AuthController;
