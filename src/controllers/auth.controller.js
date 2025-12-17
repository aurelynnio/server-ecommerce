const catchAsync = require("../configs/catchAsync");
const authService = require("../services/auth.service");
const { sendFail, sendSuccess } = require("../shared/res/formatResponse");

const { StatusCodes } = require("http-status-codes");
const jwt = require("jsonwebtoken");

const AuthController = {
  // Register new user
  register: catchAsync(async (req, res) => {


    const result = await authService.register(req.body);
    return sendSuccess(
      res,
      result,
      "Registration successful. Please verify your email.",
      StatusCodes.CREATED
    );
  }),

  // Login user
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

  // Send verification code to email
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

  // Verify email with code only
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

  // Request password reset (forgot password)
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

  // Reset password with code
  resetPassword: catchAsync(async (req, res) => {

    console.log("Reset password request body:", req.body);
    const { email, code, newPassword } = req.body;
    const result = await authService.resetPassword(email, code, newPassword);
    return sendSuccess(
      res,
      result,
      "Password reset successfully",
      StatusCodes.OK
    );
  }),

  // Refresh access token
  refreshToken: catchAsync(async (req, res) => {
    // Lấy refresh token từ cookie (ưu tiên) hoặc body (fallback)
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

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

    // Remove JWT standard claims before generating new token
    const { exp, iat, nbf, ...userPayload } = payload;

    // Generate new access token
    const tokenService = require("../services/token.service");
    const newAccessToken = tokenService.generateAccessToken(userPayload);

    // Set access token mới vào cookie (refresh token cookie giữ nguyên)
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    return sendSuccess(
      res,
      { accessToken: newAccessToken },
      "Access token refreshed successfully",
      StatusCodes.OK
    );
  }),

  // Logout
  logout: catchAsync(async (req, res) => {
    // Xóa cả 2 cookies
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

  // Change password (for authenticated user)
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
