const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");

/**
 * Middleware to validate request data using Joi schemas
 * @param {Object|Function} schemaParam - Joi schema or object of Joi schemas
 * @returns {Function} Express middleware
 */
const validate = (schemaParam) => (req, res, next) => {
  // If schemaParam is a Joi schema (has validate function), default to validating body
  // Otherwise, treat it as an object mapping request generic keys to schemas { body, query, params }
  const schemas = schemaParam.validate
    ? { body: schemaParam }
    : schemaParam;

  const validOptions = {
    abortEarly: false, // Return all errors
    allowUnknown: true, // Allow unknown keys (can be set to false if strict)
    stripUnknown: true, // Remove unknown keys from the validated object
  };

  const validationErrors = [];

  // Validate each part of the request defined in schemas
  Object.keys(schemas).forEach((key) => {
    const schema = schemas[key];
    const data = req[key];

    if (schema && data) {
      const { error, value } = schema.validate(data, validOptions);

      if (error) {
        const errors = error.details.map((detail) => detail.message);
        validationErrors.push(...errors);
      } else {
        // Assign validated data back to request (important for type conversions like number strings)
        req[key] = value;
      }
    }
  });

  if (validationErrors.length > 0) {
    return sendFail(
      res,
      validationErrors.join(", "),
      StatusCodes.BAD_REQUEST
    );
  }

  next();
};

module.exports = validate;
