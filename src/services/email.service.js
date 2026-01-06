const nodemailer = require("nodemailer");

/**
 * Create email transporter configuration
 * @returns {Object} Nodemailer transporter instance
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "cyhin2508@gmail.com",
      pass: "ontbbfoaapatkuhu",
    },
  });
};

/**
 * Generate HTML template for verification code email
 * @param {string} code - Verification code
 * @param {string} [type="email_verification"] - Type of code: 'email_verification' or 'password_reset'
 * @returns {string} HTML template string
 */
const getCodeEmailTemplate = (code, type = "email_verification") => {
  const title =
    type === "email_verification" ? "Verify Your Email" : "Reset Your Password";
  const message =
    type === "email_verification"
      ? "Thank you for registering! Please use the code below to verify your email address:"
      : "You requested to reset your password. Please use the code below:";
  const expiryTime = type === "email_verification" ? "10 minutes" : "1 hour";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #4CAF50;
          margin: 0;
        }
        .code-box {
          background-color: #f9f9f9;
          border: 2px dashed #4CAF50;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          color: #4CAF50;
          letter-spacing: 5px;
          font-family: 'Courier New', monospace;
        }
        .message {
          text-align: center;
          margin-bottom: 20px;
          color: #666;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 12px;
          margin-top: 20px;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        
        <p class="message">${message}</p>
        
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        
        <p style="text-align: center; color: #666;">
          This code will expire in <strong>${expiryTime}</strong>.
        </p>
        
        <div class="warning">
          <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email and ensure your account is secure.
        </div>
        
        <div class="footer">
          <p>This is an automated email, please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Your E-commerce App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send verification code email
 * @param {String} to - Recipient email address
 * @param {String} code - Verification code
 * @param {String} type - Type of code: 'email_verification' or 'password_reset'
 */
const sendVerificationCode = async (to, code, type = "email_verification") => {
  try {
    const transporter = createTransporter();

    const subject =
      type === "email_verification"
        ? "Verify Your Email Address"
        : "Reset Your Password";

    const mailOptions = {
      from: `"E-commerce App" <cyhin2508@gmail.com>`,
      to: to,
      subject: subject,
      html: getCodeEmailTemplate(code, type),
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Error sending email:", error);
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
