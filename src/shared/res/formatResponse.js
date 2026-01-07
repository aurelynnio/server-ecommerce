const successResponse = (data, message, code, status = "success") => {
  return {
    status: status,
    message: message,
    code: code,
    data: data,
  };
};

const failResponse = (message, code, status = "fail") => {
  return {
    status: status,
    message: message,
    code: code,
  };
};

const errorResponse = (message, code, status = "error") => {
  return {
    status: status,
    message: message,
    code: code,
  };
};

/**
 * Send success response with automatic status code setting
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {String} message - Success message
 * @param {Number} code - HTTP status code (default: 200)
 */
const sendSuccess = (res, data, message, code = 200) => {
  res.status(code);
  return res.json(successResponse(data, message, code));
};

/**
 * Send fail response with automatic status code setting
 * @param {Object} res - Express response object
 * @param {String} message - Fail message
 * @param {Number} code - HTTP status code
 */
const sendFail = (res, message, code) => {
  res.status(code);
  return res.json(failResponse(message, code));
};

/**
 * Send error response with automatic status code setting
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} code - HTTP status code
 */
const sendError = (res, message, code) => {
  res.status(code);
  return res.json(errorResponse(message, code));
};

module.exports = {
  successResponse,
  failResponse,
  errorResponse,
  sendSuccess,
  sendFail,
  sendError,
};
