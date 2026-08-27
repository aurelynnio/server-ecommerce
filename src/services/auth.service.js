const crypto = require('crypto');
const User = require('../repositories/user.repository');
const { comparePassword, hashPassword } = require('../utils/password.util');
const { getIO } = require('../socket/index');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const {
  sendEmailVerificationCode,
  sendPasswordResetCode,
  sendTwoFactorCode,
} = require('./email.service');
const redisService = require('./redis.service');
const logger = require('../utils/logger');
const tokenService = require('./token.service');
const parseDurationMs = require('../utils/parseDurationMs');

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
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hash token for safe storage
   * @param {string} token
   * @returns {string}
   */
  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get refresh token expiration date
   * @returns {Date}
   */
  _getRefreshTokenExpiresAt() {
    const ttlMs = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 16 * 24 * 60 * 60 * 1000);
    return new Date(Date.now() + ttlMs);
  }

  _sanitizeUser(user) {
    const {
      password: _password,
      codeVerifiEmail: _codeVerifiEmail,
      codeVerifiPassword: _codeVerifiPassword,
      refreshTokenHash: _refreshTokenHash,
      refreshTokenExpiresAt: _refreshTokenExpiresAt,
      ...userWithoutPassword
    } = user.toObject();

    return userWithoutPassword;
  }

  /**
   * Throw NOT_FOUND if user is null/undefined
   * @param {Object|null} user - User object
   * @throws {ApiError} 404 if user is missing
   */
  _requireUser(user) {
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }
  }

  /**
   * Send OTP code via cache + email with rollback on failure
   * @param {Object} opts
   * @param {string} opts.cacheKey - Redis key for OTP
   * @param {string} opts.code - OTP code
   * @param {string} opts.email - Recipient email
   * @param {Function} opts.sender - Email sender (email, code) => Promise
   * @param {number} [opts.ttl=600] - Cache TTL in seconds
   * @param {string} opts.errorMsg - Error message if send fails
   * @param {string[]} [opts.extraCleanupKeys=[]] - Additional keys to delete on failure
   */
  async _sendOtpCode({ cacheKey, code, email, sender, ttl = 600, errorMsg, extraCleanupKeys = [] }) {
    await redisService.set(cacheKey, code, ttl);
    try {
      await sender(email, code);
    } catch (error) {
      logger.error(`[AuthService] ${errorMsg}`, error);
      await redisService.del(cacheKey);
      for (const key of extraCleanupKeys) {
        await redisService.del(key);
      }
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
  }

  async _createAuthenticatedSession(user) {
    const permissions = tokenService.getPermissionsForUser(user);
    const tokens = tokenService.generateTokensWithPermissions(user);

    user.refreshTokenHash = this._hashToken(tokens.refreshToken);
    user.refreshTokenExpiresAt = this._getRefreshTokenExpiresAt();
    await user.save();

    return {
      user: {
        ...this._sanitizeUser(user),
        permissions,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async _sendLoginTwoFactorChallenge(user) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = this._generateVerificationCode();
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const codeKey = `otp:2fa:login:${user._id}`;

    await redisService.set(challengeKey, { userId: user._id.toString() }, 600);
    await this._sendOtpCode({
      cacheKey: codeKey,
      code: verificationCode,
      email: user.email,
      sender: sendTwoFactorCode,
      errorMsg: 'Failed to send two-factor authentication code. Please try again.',
      extraCleanupKeys: [challengeKey],
    });

    return {
      requiresTwoFactor: true,
      challengeToken,
      email: user.email,
      expiresIn: '10 minutes',
    };
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
    const existingUser = await User.findByEmail(data.email);
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already in use');
    }

    const existingUsername = await User.findByUsername(data.username);
    if (existingUsername) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username already in use');
    }

    const hashedPassword = await hashPassword(data.password);

    const newUser = User.build({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      isVerifiedEmail: false,
      provider: data.provider || 'local',
    });

    await newUser.save();

    try {
      const io = getIO();
      if (io) {
        io.emit('new_user', {
          username: newUser.username,
          _id: newUser._id,
        });
      }
    } catch (_error) {
      logger.warn('[AuthService] Socket not initialized, skipping emit');
    }

    try {
      logger.info(`[AuthService] Attempting to send verification email to ${data.email}`);
      await this.sendVerificationCode(data.email);
      logger.info(`[AuthService] Verification email sent successfully`);
    } catch (error) {
      logger.error('[AuthService] Failed to send verification email:', error);
      // Do not block registration if email fails, user can resend later
    }

    return this._sanitizeUser(newUser);
  }

  /**
   * Authenticate user and generate tokens
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} Object containing user info, access token, and refresh token
   * @throws {Error} If credentials are invalid or email is not verified
   */
  async login(email, password) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Please verify your email before logging in');
    }

    if (user.isTwoFactorEnabled) {
      return this._sendLoginTwoFactorChallenge(user);
    }

    return this._createAuthenticatedSession(user);
  }

  /**
   * Verify email using a code tied to the email address
   * Anti-enumeration: email không tồn tại trả cùng lỗi "invalid code" như code sai
   * (OTP chỉ nằm trong inbox của chủ email nên attacker không thể vượt qua check)
   * @param {string} email - User email
   * @param {string} code - Verification code
   * @returns {Promise<{ user: Object }>} Verified user data
   * @throws {Error} If user not found, already verified, or code invalid/expired
   */
  async verifyEmail(email, code) {
    const user = await User.findByEmail(email);

    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired verification code');
    }

    const cacheKey = `otp:email:${email}`;
    await this.ensureValidOtp(cacheKey, code);

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();
    await redisService.del(cacheKey);

    return { user: this._sanitizeUser(user) };
  }

  /**
   * Verify email using code only (no email required)
   * @param {string} code - Verification code
   * @returns {Promise<{ user: Object }>} Verified user data
   * @throws {Error} If code is invalid or email already verified
   */
  async verifyEmailByCode(code) {
    const user = await User.findByVerificationEmailCode(code);
    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid verification code');
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    if (user.expiresCodeVerifiEmail && user.expiresCodeVerifiEmail < new Date()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Verification code has expired');
    }

    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();

    return { user: this._sanitizeUser(user) };
  }

  /**
   * Send verification code to email (new or resend)
   * Anti-enumeration: email chưa đăng ký hoặc đã verified vẫn nhận response
   * thành công giống hệt (không gửi code) — attacker không dò được email nào
   * có tài khoản trên hệ thống qua endpoint này. Rate limit đã chặn dò hàng loạt.
   * @param {string} email - User email
   * @returns {Promise<{ email: string, message: string, expiresIn: string }>}
   * @throws {Error} If email sending fails
   */
  async sendVerificationCode(email) {
    const user = await User.findByEmail(email);

    if (!user || user.isVerifiedEmail) {
      return {
        email,
        message: 'Verification code sent successfully',
        expiresIn: '10 minutes',
      };
    }

    const verificationCode = this._generateVerificationCode();

    await redisService.set(`otp:email:${email}`, verificationCode, 600);

    user.codeVerifiEmail = verificationCode;
    user.expiresCodeVerifiEmail = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendEmailVerificationCode(email, verificationCode);
    } catch (_error) {
      user.codeVerifiEmail = undefined;
      user.expiresCodeVerifiEmail = undefined;
      await user.save();
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send verification email. Please try again.',
      );
    }

    return {
      email,
      message: 'Verification code sent successfully',
      expiresIn: '10 minutes',
    };
  }

  /**
   * Validate OTP code stored in cache
   * @param {string} cacheKey - Cache key for OTP
   * @param {string} code - OTP code
   * @returns {Promise<void>}
   * @throws {Error} If OTP is invalid or expired
   */
  async ensureValidOtp(cacheKey, code) {
    const storedCode = await redisService.get(cacheKey);

    if (!storedCode || storedCode !== code) {
      const attemptsKey = `${cacheKey}:attempts`;
      const attempts = await redisService.increment(attemptsKey, 10 * 60);
      if (attempts !== null && attempts >= 5) {
        await Promise.all([redisService.del(cacheKey), redisService.del(attemptsKey)]);
        throw new ApiError(
          StatusCodes.TOO_MANY_REQUESTS,
          'Too many invalid verification attempts. Please request a new code.',
        );
      }
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired verification code');
    }

    await redisService.del(`${cacheKey}:attempts`);
  }

  /**
   * Refresh access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{ accessToken: string, permissions: string[] }>}
   * @throws {Error} If refresh token is invalid or user not found
   */
  async refreshAccessToken(refreshToken) {
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    const user = await User.findByIdWithRefreshFields(payload.userId);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not found');
    }

    const tokenHash = this._hashToken(refreshToken);
    if (user.refreshTokenHash && user.refreshTokenHash !== tokenHash) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or revoked refresh token');
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token has expired');
    }

    const permissions = tokenService.getPermissionsForUser(user);
    const tokens = tokenService.generateTokensWithPermissions(user);

    user.refreshTokenHash = this._hashToken(tokens.refreshToken);
    user.refreshTokenExpiresAt = this._getRefreshTokenExpiresAt();
    await user.save();

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      permissions,
    };
  }

  /**
   * Revoke refresh token (logout)
   * @param {string} refreshToken
   * @returns {Promise<void>}
   */
  async revokeRefreshToken(refreshToken) {
    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      await User.clearRefreshToken(payload.userId);
    } catch (_error) {
      // Ignore invalid token on logout
    }
  }

  /**
   * Send password reset code to email
   * @param {string} email - User email
   * @returns {Promise<{ email: string }>}
   * @throws {Error} If user not found or email sending fails
   */
  async forgotPassword(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      return { email };
    }

    const resetCode = this._generateVerificationCode();

    await this._sendOtpCode({
      cacheKey: `otp:reset-password:${email}`,
      code: resetCode,
      email,
      sender: sendPasswordResetCode,
      ttl: 3600,
      errorMsg: 'Failed to send password reset email. Please try again.',
    });

    return { email };
  }

  /**
   * Reset password using verification code
   * Anti-enumeration: email không tồn tại trả cùng lỗi "invalid code" như code sai
   * @param {string} email - User email
   * @param {string} code - Reset code
   * @param {string} newPassword - New password
   * @returns {Promise<{ email: string }>}
   * @throws {Error} If user not found or code invalid
   */
  async resetPassword(email, code, newPassword) {
    const user = await User.findByEmail(email);

    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired verification code');
    }

    const cacheKey = `otp:reset-password:${email}`;
    await this.ensureValidOtp(cacheKey, code);

    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    await redisService.del(cacheKey);

    return { email: user.email };
  }

  /**
   * Change password for authenticated user
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<{ userId: string }>}
   * @throws {Error} If user not found or current password invalid
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    this._requireUser(user);

    const isMatch = await comparePassword(currentPassword, user.password);

    if (!isMatch) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    return { userId: user._id };
  }

  async sendTwoFactorManagementCode(userId, action) {
    const user = await User.findById(userId);
    this._requireUser(user);

    if (!user.isVerifiedEmail) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Please verify your email before enabling two-factor authentication',
      );
    }

    if (action === 'enable' && user.isTwoFactorEnabled) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Two-factor authentication is already enabled');
    }

    if (action === 'disable' && !user.isTwoFactorEnabled) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Two-factor authentication is not enabled');
    }

    const code = this._generateVerificationCode();
    const cacheKey = `otp:2fa:${action}:${userId}`;

    await this._sendOtpCode({
      cacheKey,
      code,
      email: user.email,
      sender: sendTwoFactorCode,
      errorMsg: 'Failed to send two-factor authentication code. Please try again.',
    });

    return {
      action,
      email: user.email,
      expiresIn: '10 minutes',
    };
  }

  async confirmTwoFactorManagement(userId, action, code) {
    const user = await User.findById(userId);
    this._requireUser(user);

    const cacheKey = `otp:2fa:${action}:${userId}`;
    await this.ensureValidOtp(cacheKey, code);

    user.isTwoFactorEnabled = action === 'enable';
    await user.save();
    await redisService.del(cacheKey);

    return this._sanitizeUser(user);
  }

  async verifyLoginTwoFactor(challengeToken, code) {
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const challenge = await redisService.get(challengeKey);

    if (!challenge?.userId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired two-factor challenge');
    }

    const user = await User.findById(challenge.userId);
    this._requireUser(user);

    await this.ensureValidOtp(`otp:2fa:login:${user._id}`, code);

    await redisService.del(challengeKey);
    await redisService.del(`otp:2fa:login:${user._id}`);

    return this._createAuthenticatedSession(user);
  }

  async resendLoginTwoFactorCode(challengeToken) {
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const challenge = await redisService.get(challengeKey);

    if (!challenge?.userId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired two-factor challenge');
    }

    const user = await User.findById(challenge.userId);
    this._requireUser(user);

    const verificationCode = this._generateVerificationCode();
    const codeKey = `otp:2fa:login:${user._id}`;

    await this._sendOtpCode({
      cacheKey: codeKey,
      code: verificationCode,
      email: user.email,
      sender: sendTwoFactorCode,
      errorMsg: 'Failed to send two-factor authentication code. Please try again.',
    });

    return {
      email: user.email,
      expiresIn: '10 minutes',
    };
  }
}

module.exports = new AuthService();
