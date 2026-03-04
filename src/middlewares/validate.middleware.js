const { ApiError } = require('./errorHandler.middleware');
const { StatusCodes } = require('http-status-codes');

/**
 * Middleware to validate request data using Joi schemas
 * @param {Object|Function} schemaParam - Joi schema or object of Joi schemas
 * @returns {Function} Express middleware
 */
const validate = (schemaParam) => (req, res, next) => {
  const schemas = schemaParam.validate ? { body: schemaParam } : schemaParam;

  const validOptions = {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  };

  const validationErrors = [];

  Object.keys(schemas).forEach((key) => {
    const schema = schemas[key];
    const data = req[key] ?? {};

    if (schema) {
      const { error, value } = schema.validate(data, validOptions);

      if (error) {
        const errors = error.details.map((detail) => detail.message);
        validationErrors.push(...errors);
      } else {
        req[key] = value;
      }
    }
  });

  if (validationErrors.length > 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, validationErrors.join(', '));
  }

  next();
};

module.exports = validate;
