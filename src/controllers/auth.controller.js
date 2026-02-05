const catchAsync = require("../configs/catchAsync");
const authService = require("../services/auth.service");
const { sendFail, sendSuccess } = require("../shared/res/formatResponse");
const parseDurationMs = require("../utils/parseDurationMs");

const { StatusCodes } = require("http-status-codes");

const AuthController = {
  /**
   * Register
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Login
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  login: catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    const { accessToken, refreshToken, user } = result;

    const refreshTtlMs = parseDurationMs(
      process.env.JWT_REFRESH_EXPIRES_IN,
      16 * 24 * 60 * 60 * 1000
    );
    const accessTtlMs = parseDurationMs(
      process.env.JWT_ACCESS_EXPIRES_IN,
      30 * 60 * 1000
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTtlMs,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: accessTtlMs,
    });

    return sendSuccess(
      res,
      user,
      "Login successful",
      StatusCodes.OK
    );
  }),

  /**
   * Send verification code
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Verify email
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  verifyEmail: catchAsync(async (req, res) => {
    const { email, code } = req.body;
    const result = await authService.verifyEmail(email, code);
    return sendSuccess(
      res,
      result.user,
      "Email verified successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Forgot password
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Reset password
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
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
   * Refresh token
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  refreshToken: catchAsync(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return sendFail(
        res,
        "Refresh token is required",
        StatusCodes.BAD_REQUEST
      );
    }

    const result = await authService.refreshAccessToken(refreshToken);

    const accessTtlMs = parseDurationMs(
      process.env.JWT_ACCESS_EXPIRES_IN,
      30 * 60 * 1000
    );
    const refreshTtlMs = parseDurationMs(
      process.env.JWT_REFRESH_EXPIRES_IN,
      16 * 24 * 60 * 60 * 1000
    );

    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: accessTtlMs,
    });

    if (result.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: refreshTtlMs,
      });
    }

    return sendSuccess(
      res,
      { permissions: result.permissions },
      "Access token refreshed successfully",
      StatusCodes.OK
    );
  }),

  /**
   * Logout
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  logout: catchAsync(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

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
   * Change password
   * @param {Object} req
   * @param {Object} res
   * @returns {Promise<any>}
   */
  changePassword: catchAsync(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendFail(res, "Unauthorized", StatusCodes.UNAUTHORIZED);
    }

    const result = await authService.changePassword(
      userId,
      oldPassword,
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
