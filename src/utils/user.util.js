/**
 * Utilities for user model/data operations
 */

const SENSITIVE_USER_FIELDS = [
  'password',
  'codeVerifiEmail',
  'codeVerifiPassword',
  'expiresCodeVerifiEmail',
  'expiresCodeVerifiPassword',
  'refreshTokenHash',
  'refreshTokenExpiresAt',
  'tokens',
  'otp',
  'verificationToken',
  'passwordResetToken',
  'twoFactorSecret',
  '__v',
];

/**
 * Strip sensitive credentials and security tokens from a user document or object
 * @param {Object} user - User document or plain object
 * @returns {Object} Sanitized user object without sensitive fields
 */
function sanitizeUser(user) {
  if (!user) return user;
  const userObj =
    typeof user.toObject === 'function' ? user.toObject({ transform: false }) : { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete userObj[field];
  }
  return userObj;
}

/**
 * Sanitize an array of user objects
 * @param {Array} users
 * @returns {Array}
 */
function sanitizeUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.map(sanitizeUser);
}

module.exports = {
  SENSITIVE_USER_FIELDS,
  sanitizeUser,
  sanitizeUsers,
};
