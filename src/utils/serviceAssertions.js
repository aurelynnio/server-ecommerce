const { StatusCodes } = require('http-status-codes');
const ApiError = require('./ApiError');

const ensureFound = (value, message = 'Resource not found') => {
  if (!value) {
    throw new ApiError(StatusCodes.NOT_FOUND, message);
  }

  return value;
};

module.exports = {
  ensureFound,
};
