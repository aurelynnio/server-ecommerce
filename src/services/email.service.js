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

/**
 * PERFORMANCE FIX: Singleton transporter - reuse connection pool
 */
let transporter = null;

/**
 * Get or create email transporter (singleton pattern)
 * @returns {Object} Nodemailer transporter instance
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      pool: true, // Use connection pooling
      maxConnections: 5, // Max 5 concurrent connections
      maxMessages: 100, // Max 100 messages per connection
      auth: {
        user: "cyhincdr@gmail.com",
        pass: "plnbqekohbjynjlt",
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

    const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const verificationLink = `${baseUrl}/verify-code?email=${to}&code=${code}`;

    const emailHtml = await render(
      React.createElement(VerificationEmail, {
        verificationCode: code,
        verificationLink: verificationLink,
      }),
    );

    const mailOptions = {
      from: `"E-commerce App" <cyhin2508@gmail.com>`,
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
    throw new Error(`Failed to send email: ${error.message}`);
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
