require("@babel/register")({
  presets: ["@babel/preset-react", "@babel/preset-env"],
  ignore: [/node_modules/],
  extensions: [".jsx", ".js"],
  cache: false,
});

const nodemailer = require("nodemailer");
const React = require("react");
const { render } = require("@react-email/render");
const VerificationEmail = require("../emails/VerificationEmail").default;
const logger = require("../utils/logger");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

let transporter = null;

// Hardcoded email configuration (per request)
const EMAIL_CONFIG = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "cyhin2508@gmail.com",
    pass: "qanqnxjxrdlogwdz",
  },
  from: "cyhincdr@gmail.com",
  baseUrl: "https://cyhin.engineer",
  maxConnections: 5,
  maxMessages: 100,
};

/**
 * Get or create email transporter (singleton pattern)
 * @returns {Object} Nodemailer transporter instance
 */
const getTransporter = () => {
  /**
   * If
   * @param {any} !transporter
   * @returns {any}
   */
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      pool: true, // Use connection pooling
      maxConnections: EMAIL_CONFIG.maxConnections,
      maxMessages: EMAIL_CONFIG.maxMessages,
      auth: {
        user: EMAIL_CONFIG.auth.user,
        pass: EMAIL_CONFIG.auth.pass,
      },
    });
  }
  return transporter;
};

/**
 * Send verification code email
 * @param {String} to - Recipient email address
 * @param {String} code - Verification code
 * @param {String} type - Type of code: 'email_verification' or 'password_reset'
 */
const sendVerificationCode = async (to, code, type = "email_verification") => {
  try {
    const transporter = getTransporter();

    const subject =
      type === "email_verification"
        ? "Verify Your Email Address"
        : "Reset Your Password";

    const verificationLink = `${EMAIL_CONFIG.baseUrl}/verify-code?email=${to}&code=${code}`;

    const emailHtml = await render(
      React.createElement(VerificationEmail, {
        verificationCode: code,
        verificationLink: verificationLink,
      }),
    );

    const mailOptions = {
      from: EMAIL_CONFIG.from,
      to: to,
      subject: subject,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error("Error sending email:", { error: error.message });
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      `Failed to send email: ${error.message}`,
    );
  }
};

/**
 * Send email verification code
 * @param {String} to - Recipient email address
 * @param {String} code - Verification code
 */
const sendEmailVerificationCode = async (to, code) => {
  return sendVerificationCode(to, code, "email_verification");
};

/**
 * Send password reset code
 * @param {String} to - Recipient email address
 * @param {String} code - Reset code
 */
const sendPasswordResetCode = async (to, code) => {
  return sendVerificationCode(to, code, "password_reset");
};

module.exports = {
  sendVerificationCode,
  sendEmailVerificationCode,
  sendPasswordResetCode,
};
