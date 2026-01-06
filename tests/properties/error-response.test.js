/**
 * Property Tests for Error Response Format
 * Tests Property 8: Error Status Code Mapping
 * Tests Property 9: Error Response Format
 * Validates: Requirements 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

const fc = require("fast-check");
const { StatusCodes } = require("http-status-codes");
const {
  ApiError,
  getStatusCode,
  getErrorMessage,
  errorHandler,
} = require("../../src/middlewares/errorHandler.middleware");

describe("Property 8: Error Status Code Mapping", () => {
  it("should map ValidationError to 400 Bad Request", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const error = new Error(message);
        error.name = "ValidationError";
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.BAD_REQUEST);
      })
    );
  });

  it("should map CastError to 400 Bad Request", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const error = new Error(message);
        error.name = "CastError";
        error.path = "_id";
        error.value = "invalid";
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.BAD_REQUEST);
      })
    );
  });

  it("should map JsonWebTokenError to 401 Unauthorized", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const error = new Error(message);
        error.name = "JsonWebTokenError";
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.UNAUTHORIZED);
      })
    );
  });

  it("should map TokenExpiredError to 401 Unauthorized", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const error = new Error(message);
        error.name = "TokenExpiredError";
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.UNAUTHORIZED);
      })
    );
  });

  it("should map MongoDB duplicate key error (code 11000) to 409 Conflict", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (field) => {
        const error = new Error("Duplicate key");
        error.code = 11000;
        error.keyValue = { [field]: "value" };
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.CONFLICT);
      })
    );
  });

  it("should use statusCode from ApiError if provided", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        (code, message) => {
          const error = new ApiError(code, message);
          const statusCode = getStatusCode(error);
          expect(statusCode).toBe(code);
        }
      )
    );
  });

  it("should default to 500 for unknown errors", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        const error = new Error(message);
        error.name = "UnknownError";
        const statusCode = getStatusCode(error);
        expect(statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      })
    );
  });
});

describe("Property 9: Error Response Format", () => {
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
    };
    mockNext = () => {};
  });

  it("should always include status, message, and code in response", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.body).toHaveProperty("status");
          expect(mockRes.body).toHaveProperty("message");
          expect(mockRes.body).toHaveProperty("code");
        }
      )
    );
  });

  it("should set status to 'fail' for 4xx errors", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 499 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.body.status).toBe("fail");
        }
      )
    );
  });

  it("should set status to 'error' for 5xx errors", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.body.status).toBe("error");
        }
      )
    );
  });

  it("should set HTTP status code correctly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.statusCode).toBe(statusCode);
          expect(mockRes.body.code).toBe(statusCode);
        }
      )
    );
  });

  it("should provide user-friendly message for JWT errors", () => {
    const jwtErrors = ["JsonWebTokenError", "TokenExpiredError"];

    jwtErrors.forEach((errorName) => {
      const error = new Error("jwt malformed");
      error.name = errorName;
      const mockReq = {};

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.body.message).not.toContain("jwt malformed");
      expect(mockRes.body.message.toLowerCase()).toMatch(
        /token|log in|invalid|expired/
      );
    });
  });

  it("should provide user-friendly message for CastError", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 24 }),
        (invalidId) => {
          const error = new Error("Cast to ObjectId failed");
          error.name = "CastError";
          error.path = "_id";
          error.value = invalidId;
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.body.message).toContain("Invalid");
          expect(mockRes.body.message).toContain("_id");
        }
      )
    );
  });

  it("should provide user-friendly message for duplicate key error", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("email", "username", "slug"),
        (field) => {
          const error = new Error("Duplicate key");
          error.code = 11000;
          error.keyValue = { [field]: "duplicate_value" };
          const mockReq = {};

          errorHandler(error, mockReq, mockRes, mockNext);

          expect(mockRes.body.message.toLowerCase()).toContain("already exists");
        }
      )
    );
  });
});

describe("ApiError Class", () => {
  it("should create error with correct properties", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);

          expect(error).toBeInstanceOf(Error);
          expect(error.statusCode).toBe(statusCode);
          expect(error.message).toBe(message);
          expect(error.isOperational).toBe(true);
        }
      )
    );
  });

  it("should set status based on status code", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 499 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          expect(error.status).toBe("fail");
        }
      )
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        fc.string({ minLength: 1 }),
        (statusCode, message) => {
          const error = new ApiError(statusCode, message);
          expect(error.status).toBe("error");
        }
      )
    );
  });
});

describe("Error Message Extraction", () => {
  it("should extract messages from Joi validation errors", () => {
    const joiError = {
      name: "ValidationError",
      details: [
        { message: "Email is required" },
        { message: "Password must be at least 6 characters" },
      ],
    };

    const message = getErrorMessage(joiError);
    expect(message).toContain("Email is required");
    expect(message).toContain("Password must be at least 6 characters");
  });

  it("should extract messages from Mongoose validation errors", () => {
    const mongooseError = {
      name: "ValidationError",
      errors: {
        email: { message: "Email is required" },
        password: { message: "Password is required" },
      },
    };

    const message = getErrorMessage(mongooseError);
    expect(message).toContain("Email is required");
    expect(message).toContain("Password is required");
  });

  it("should return original message for operational errors", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (msg) => {
        const error = new ApiError(400, msg);
        const message = getErrorMessage(error);
        expect(message).toBe(msg);
      })
    );
  });
});
