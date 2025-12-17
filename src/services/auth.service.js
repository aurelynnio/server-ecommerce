const User = require("../models/user.model");
const comparePassword = require("../utils/comparePassword");
const hashPassword = require("../utils/hashPasword");
const {
  sendEmailVerificationCode,
  sendPasswordResetCode,
} = require("./email.service");

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
      throw new Error("Email already in use");
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: data.username });
    if (existingUsername) {
      throw new Error("Username already in use");
    }

    // Hash password
    const hashedPassword = hashPassword(data.password);

    // Create new user (without verification code)
    const newUser = new User({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      isVerifiedEmail: false,
      provider: data.provider || "local",
    });

    await newUser.save();

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
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isMatch = comparePassword(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    // Check if email is verified
    if (!user.isVerifiedEmail) {
      throw new Error("Please verify your email before logging in");
    }

    // Generate tokens
    const tokenService = require("./token.service");
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.roles,
    };

    const accessToken = tokenService.generateAccessToken(payload);
    const refreshToken = tokenService.generateRefreshToken(payload);

    // Remove sensitive data
    const {
      password: _,
      codeVerifiEmail,
      codeVerifiPassword,
      ...userWithoutPassword
    } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  // Verify email with code
  async verifyEmail(email, code) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerifiedEmail) {
      throw new Error("Email already verified");
    }

    // Check if code matches
    if (user.codeVerifiEmail !== code) {
      throw new Error("Invalid verification code");
    }

    // Check if code expired
    if (
      user.expiresCodeVerifiEmail &&
      user.expiresCodeVerifiEmail < new Date()
    ) {
      throw new Error("Verification code has expired");
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
      throw new Error("Invalid verification code");
    }

    if (user.isVerifiedEmail) {
      throw new Error("Email already verified");
    }

    // Check if code expired
    if (
      user.expiresCodeVerifiEmail &&
      user.expiresCodeVerifiEmail < new Date()
    ) {
      throw new Error("Verification code has expired");
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
      throw new Error("User not found");
    }

    if (user.isVerifiedEmail) {
      throw new Error("Email already verified");
    }

    // Generate new code
    const verificationCode = this._generateVerificationCode();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.codeVerifiEmail = verificationCode;
    user.expiresCodeVerifiEmail = codeExpiry;
    await user.save();

    // Send verification email
    try {
      // In development, log code to console
      if (process.env.NODE_ENV === "development") {
        console.log("📧 Email Verification Code:", verificationCode);
        console.log("📧 Code expires in 10 minutes");
      }
      await sendEmailVerificationCode(email, verificationCode);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // In development, still log the code
      if (process.env.NODE_ENV === "development") {
        console.log(
          "⚠️  Email failed but you can use this code:",
          verificationCode
        );
      }
      throw new Error("Failed to send verification email. Please try again.");
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
      throw new Error("User not found");
    }

    // Generate password reset code
    const resetCode = this._generateVerificationCode();
    const codeExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.codeVerifiPassword = resetCode;
    user.expiresCodeVerifiPassword = codeExpiry;
    await user.save();

    // Send reset code via email
    try {
      await sendPasswordResetCode(email, resetCode);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      throw new Error("Failed to send password reset email. Please try again.");
    }

    return { email };
  }

  // Reset password with code
  async resetPassword(email, code, newPassword) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    // Check if code matches
    if (user.codeVerifiPassword !== code) {
      throw new Error("Invalid reset code");
    }

    // Check if code expired
    if (
      user.expiresCodeVerifiPassword &&
      user.expiresCodeVerifiPassword < new Date()
    ) {
      throw new Error("Reset code has expired");
    }

    // Hash new password
    const hashedPassword = hashPassword(newPassword);

    // Update password and clear reset code
    user.password = hashedPassword;
    user.codeVerifiPassword = undefined;
    user.expiresCodeVerifiPassword = undefined;
    await user.save();

    return { email: user.email };
  }

  // Change password (authenticated user)
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isMatch = comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    // Hash and update new password
    const hashedPassword = hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return { userId: user._id };
  }
}

module.exports = new AuthService();
