const bcrypt = require("bcrypt");

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - The plain text password to check
 * @param {string} hashedPassword - The bcrypt hashed password from database
 * @returns {boolean} True if passwords match, false otherwise
 */
const comparePassword = (password, hashedPassword) => {
  return bcrypt.compareSync(password, hashedPassword);
};

module.exports = comparePassword;
