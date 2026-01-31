const User = require("../models/user.model");
const comparePassword = require("../utils/comparePassword");
const hashPassword = require("../utils/hashPasword");
const { getIO } = require("../socket/index");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");
const {
  sendEmailVerificationCode,
  sendPasswordResetCode,
} = require("./email.service");
const cacheService = require("./cache.service");
const logger = require("../utils/logger");

/**
 * Service handling authentication logic
 * Includes registration, login, password management, and email verification
 */
class AuthService {
  /**
   * Generate a random 6-digit verification code
   * @private
   * @returns {string} 6-digit code
   */
  _generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Register a new user
   * @param {Object} data - User registration data
   * @param {string} data.username - User's username
   * @param {string} data.email - User's email
   * @param {string} data.password - User's password
   * @param {string} [data.provider] - Auth provider (local/google)
   * @returns {Promise<Object>} Created user object (without sensitive data)
   * @throws {Error} If email or username already exists
   */
  async register(data) {
    // Check if email already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, "Email already in use");
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: data.username });
    if (existingUsername) {
      throw new ApiError(StatusCodes.CONFLICT, "Username already in use");
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);


    // Create new user (without verification code)
    const newUser = new User({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      isVerifiedEmail: false,
      provider: data.provider || "local",
    });

    await newUser.save();

    // Emit socket event
    const io = getIO();
    if (io) {
      io.emit("new_user", {
        username: newUser.username,
        _id: newUser._id,
      });
    }

    // Send verification email
    try {
      logger.info(
        `[AuthService] Attempting to send verification email to ${data.email}`,
      );
      await this.sendVerificationCode(data.email);
      logger.info(`[AuthService] Verification email sent successfully`);
    } catch (error) {
      logger.error("[AuthService] Failed to send verification email:", error);
      // Do not block registration if email fails, user can resend later
    }

    // Remove sensitive data
    const userObj = newUser.toObject();
    delete userObj.password;
    delete userObj.codeVerifiEmail;
    delete userObj.codeVerifiPassword;

    return userObj;
  }

  /**
   * Authenticate user and generate tokens
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} Object containing user info, access token, and refresh token
   * @throws {Error} If credentials are invalid or email is not verified
   */
  async login(email, password) {
    // Find user by email
    const user = await User.findOne({ email }).lean();
    if (!user) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Invalid email or password"
      );
    }

    // Verify password
    const isMatch = comparePassword(password, user.password);
    if (!isMatch) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Invalid email or password"
      );
    }

    // Check if email is verified
    if (!user.isVerifiedEmail) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Please verify your email before logging in"
      );
    }

    // Generate tokens with permissions
    const tokenService = require("./token.service");
    const permissionService = require("./permission.service");

    // Get user permissions
    const permissions = permissionService.getUserPermissions(user);

    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.roles,
      permissions: permissions,
    };

    const accessToken = tokenService.generateAccessToken(payload);
    const refreshToken = tokenService.generateRefreshToken({
      userId: user._id,
    });

    // Remove sensitive data
    const {
      password: _,
      codeVerifiEmail,
      codeVerifiPassword,
      ...userWithoutPassword
    } = user;

    return {
      user: {
        ...userWithoutPassword,
        permissions: permissions,
      },
      accessToken,
      refreshToken,
    };
  }

  // Verify email with code
  async verifyEmail(email, code) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email already verified");
    }

    // Check code in Redis
    const cacheKey = `otp:email:${email}`;
    const storedCode = await cacheService.get(cacheKey);

    if (!storedCode || storedCode !== code) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid or expired verification code"
      );
    }

    // Update user
    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();

    // Return user info without sensitive data
    const {
      password,
      codeVerifiEmail,
      codeVerifiPassword,
      ...userWithoutPassword
    } = user.toObject();
    return { user: userWithoutPassword };
  }

  // Verify email by code only (no email required)
  async verifyEmailByCode(code) {
    // Find user by verification code
    const user = await User.findOne({ codeVerifiEmail: code });
    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid verification code");
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email already verified");
    }

    // Check if code expired
    if (
      user.expiresCodeVerifiEmail &&
      user.expiresCodeVerifiEmail < new Date()
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Verification code has expired"
      );
    }

    // Update user
    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();

    // Return user info without sensitive data
    const {
      password,
      codeVerifiEmail,
      codeVerifiPassword,
      ...userWithoutPassword
    } = user.toObject();
    return { user: userWithoutPassword };
  }

  // Send verification code to email (for both new users and resend)
  async sendVerificationCode(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email already verified");
    }

    // Generate new code
    const verificationCode = this._generateVerificationCode();

    // Save to Redis (expire in 10 minutes)
    await cacheService.set(`otp:email:${email}`, verificationCode, 600);

    // Save to User document for verifyEmailByCode
    user.codeVerifiEmail = verificationCode;
    user.expiresCodeVerifiEmail = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send verification email
    try {
      await sendEmailVerificationCode(email, verificationCode);
    } catch (error) {
      // Rollback user update if email fails
      user.codeVerifiEmail = undefined;
      user.expiresCodeVerifiEmail = undefined;
      await user.save();
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to send verification email. Please try again."
      );
    }

    return {
      email,
      message: "Verification code sent successfully",
      expiresIn: "10 minutes",
    };
  }

  // Forgot password - send reset code
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Generate password reset code
    const resetCode = this._generateVerificationCode();

    // Save to Redis (expire in 1 hour)
    await cacheService.set(`otp:reset-password:${email}`, resetCode, 3600);

    // Send reset code via email
    try {
      await sendPasswordResetCode(email, resetCode);
    } catch (error) {
      logger.error("Failed to send password reset email:", error);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to send password reset email. Please try again."
      );
    }

    return { email };
  }

  // Reset password with code
  async resetPassword(email, code, newPassword) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Check code in Redis
    const cacheKey = `otp:reset-password:${email}`;
    const storedCode = await cacheService.get(cacheKey);

    if (!storedCode || storedCode !== code) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid or expired reset code"
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);


    // Update password and clear reset code
    user.password = hashedPassword;
    await user.save();

    // Clear Redis OTP
    await cacheService.del(cacheKey);

    return { email: user.email };
  }

  // Change password (authenticated user)
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Verify current password
    const isMatch = comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Current password is incorrect"
      );
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    return { userId: user._id };
  }
}

module.exports = new AuthService();
