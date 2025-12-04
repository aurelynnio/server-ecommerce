const bcrypt = require("bcrypt");

/**
 * Hash a password using bcrypt
 * @param {string} password - The plain text password to hash
 * @returns {string} The hashed password string
 */
const hashPassword = (password) => {
  const saltRounds = 10;
  return bcrypt.hashSync(password, saltRounds);
};
module.exports = hashPassword;
