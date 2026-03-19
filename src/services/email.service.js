require('@babel/register')({
  presets: ['@babel/preset-react', '@babel/preset-env'],
  ignore: [/node_modules/],
  extensions: ['.jsx', '.js'],
  cache: false,
});

const nodemailer = require('nodemailer');
const React = require('react');
const { render } = require('@react-email/render');
const VerificationEmail = require('../emails/VerificationEmail').default;
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');

let transporter = null;

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  baseUrl: process.env.EMAIL_BASE_URL || 'https://cyhin.engineer',
  maxConnections: Number(process.env.EMAIL_MAX_CONNECTIONS) || 5,
  maxMessages: Number(process.env.EMAIL_MAX_MESSAGES) || 100,
};

const getMissingEmailConfig = () => {
  const missing = [];

  if (!EMAIL_CONFIG.auth.user) missing.push('EMAIL_USER');
  if (!EMAIL_CONFIG.auth.pass) missing.push('EMAIL_PASS');
  if (!EMAIL_CONFIG.from) missing.push('EMAIL_FROM');

  return missing;
};

/**
 * Get or create email transporter (singleton pattern)
 * @returns {Object} Nodemailer transporter instance
 */
const getTransporter = () => {
  const missingConfig = getMissingEmailConfig();
  if (missingConfig.length > 0) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      `Email service is not configured: missing ${missingConfig.join(', ')}`,
    );
  }

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
const sendVerificationCode = async (to, code, type = 'email_verification') => {
  try {
    const transporter = getTransporter();

    const subject =
      type === 'email_verification' ? 'Verify Your Email Address' : 'Reset Your Password';

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
    logger.error('Error sending email', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
    });
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Email delivery failed');
  }
};

/**
 * Send email verification code
 * @param {String} to - Recipient email address
 * @param {String} code - Verification code
 */
const sendEmailVerificationCode = async (to, code) => {
  return sendVerificationCode(to, code, 'email_verification');
};

/**
 * Send password reset code
 * @param {String} to - Recipient email address
 * @param {String} code - Reset code
 */
const sendPasswordResetCode = async (to, code) => {
  return sendVerificationCode(to, code, 'password_reset');
};

module.exports = {
  sendVerificationCode,
  sendEmailVerificationCode,
  sendPasswordResetCode,
};
