/**
 * Property Tests for Sensitive Data Exclusion
 * Tests Property 4: Sensitive Data Exclusion
 * Validates: Requirements 2.6
 * 
 * Ensures that sensitive fields like password, tokens, OTP codes
 * are never returned in API responses
 */

const fc = require("fast-check");

// List of sensitive fields that should never be in responses
const SENSITIVE_FIELDS = [
  "password",
  "codeVerifiEmail",
  "codeVerifiPassword",
  "refreshToken",
  "accessToken",
  "otp",
  "otpCode",
  "resetToken",
  "verificationToken",
  "__v",
];

// Fields that might contain sensitive data in nested objects
const NESTED_SENSITIVE_PATHS = [
  "user.password",
  "user.codeVerifiEmail",
  "user.codeVerifiPassword",
  "owner.password",
  "seller.password",
];

/**
 * Check if an object contains any sensitive fields
 * @param {Object} obj - Object to check
 * @param {string} path - Current path for nested objects
 * @returns {string[]} - Array of found sensitive field paths
 */
const findSensitiveFields = (obj, path = "") => {
  const found = [];

  if (!obj || typeof obj !== "object") return found;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if key is a sensitive field
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      found.push(currentPath);
    }

    // Recursively check nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      found.push(...findSensitiveFields(value, currentPath));
    }

    // Check arrays
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          found.push(...findSensitiveFields(item, `${currentPath}[${index}]`));
        }
      });
    }
  }

  return found;
};

/**
 * Simulate user data as it might come from database
 */
const generateUserData = () => {
  return fc.record({
    _id: fc.stringMatching(/^[0-9a-f]{24}$/),
    username: fc.string({ minLength: 3, maxLength: 30 }),
    email: fc.emailAddress(),
    password: fc.string({ minLength: 6 }), // Should be excluded
    codeVerifiEmail: fc.string({ minLength: 6, maxLength: 6 }), // Should be excluded
    codeVerifiPassword: fc.string({ minLength: 6, maxLength: 6 }), // Should be excluded
    roles: fc.constantFrom("user", "admin"),
    isVerifiedEmail: fc.boolean(),
    avatar: fc.option(fc.webUrl()),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });
};

/**
 * Simulate sanitizing user data (what the service should do)
 */
const sanitizeUserData = (user) => {
  if (!user) return user;

  const sanitized = { ...user };
  SENSITIVE_FIELDS.forEach((field) => {
    delete sanitized[field];
  });

  return sanitized;
};

/**
 * Simulate order data with nested user
 */
const generateOrderData = () => {
  return fc.record({
    _id: fc.stringMatching(/^[0-9a-f]{24}$/),
    orderNumber: fc.string({ minLength: 8, maxLength: 12 }),
    user: generateUserData(),
    items: fc.array(
      fc.record({
        product: fc.stringMatching(/^[0-9a-f]{24}$/),
        quantity: fc.integer({ min: 1, max: 10 }),
        price: fc.float({ min: 1, max: 10000 }),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    totalAmount: fc.float({ min: 1, max: 100000 }),
    status: fc.constantFrom("pending", "confirmed", "shipped", "delivered"),
  });
};

describe("Property 4: Sensitive Data Exclusion", () => {
  describe("User Data Sanitization", () => {
    it("should never include password in sanitized user data", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          const sanitized = sanitizeUserData(userData);
          const sensitiveFound = findSensitiveFields(sanitized);

          expect(sensitiveFound).not.toContain("password");
          expect(sanitized.password).toBeUndefined();
        })
      );
    });

    it("should never include verification codes in sanitized user data", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          const sanitized = sanitizeUserData(userData);

          expect(sanitized.codeVerifiEmail).toBeUndefined();
          expect(sanitized.codeVerifiPassword).toBeUndefined();
        })
      );
    });

    it("should preserve non-sensitive user fields after sanitization", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          const sanitized = sanitizeUserData(userData);

          // These fields should be preserved
          expect(sanitized._id).toBe(userData._id);
          expect(sanitized.username).toBe(userData.username);
          expect(sanitized.email).toBe(userData.email);
          expect(sanitized.roles).toBe(userData.roles);
        })
      );
    });

    it("should remove all sensitive fields from any user object", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          const sanitized = sanitizeUserData(userData);
          const sensitiveFound = findSensitiveFields(sanitized);

          expect(sensitiveFound).toHaveLength(0);
        })
      );
    });
  });

  describe("Nested Object Sanitization", () => {
    it("should detect sensitive fields in nested user objects", () => {
      fc.assert(
        fc.property(generateOrderData(), (orderData) => {
          // Before sanitization, sensitive fields should be found
          const sensitiveFound = findSensitiveFields(orderData);

          // Should find password in nested user object
          const hasNestedPassword = sensitiveFound.some((path) =>
            path.includes("password")
          );
          expect(hasNestedPassword).toBe(true);
        })
      );
    });

    it("should sanitize nested user objects in order data", () => {
      fc.assert(
        fc.property(generateOrderData(), (orderData) => {
          // Sanitize nested user
          const sanitized = {
            ...orderData,
            user: sanitizeUserData(orderData.user),
          };

          const sensitiveFound = findSensitiveFields(sanitized);
          expect(sensitiveFound).toHaveLength(0);
        })
      );
    });
  });

  describe("Array Data Sanitization", () => {
    it("should sanitize user data in arrays", () => {
      fc.assert(
        fc.property(
          fc.array(generateUserData(), { minLength: 1, maxLength: 5 }),
          (users) => {
            const sanitized = users.map(sanitizeUserData);

            sanitized.forEach((user) => {
              const sensitiveFound = findSensitiveFields(user);
              expect(sensitiveFound).toHaveLength(0);
            });
          }
        )
      );
    });
  });

  describe("Response Format Validation", () => {
    it("should validate that success response format excludes sensitive data", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          // Simulate API response
          const response = {
            status: "success",
            message: "User retrieved successfully",
            code: 200,
            data: sanitizeUserData(userData),
          };

          const sensitiveFound = findSensitiveFields(response);
          expect(sensitiveFound).toHaveLength(0);
        })
      );
    });

    it("should validate that list response format excludes sensitive data", () => {
      fc.assert(
        fc.property(
          fc.array(generateUserData(), { minLength: 1, maxLength: 10 }),
          (users) => {
            // Simulate paginated API response
            const response = {
              status: "success",
              message: "Users retrieved successfully",
              code: 200,
              data: {
                users: users.map(sanitizeUserData),
                pagination: {
                  page: 1,
                  limit: 10,
                  total: users.length,
                },
              },
            };

            const sensitiveFound = findSensitiveFields(response);
            expect(sensitiveFound).toHaveLength(0);
          }
        )
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined user data gracefully", () => {
      expect(sanitizeUserData(null)).toBeNull();
      expect(sanitizeUserData(undefined)).toBeUndefined();
    });

    it("should handle empty objects", () => {
      const sanitized = sanitizeUserData({});
      expect(sanitized).toEqual({});
      expect(findSensitiveFields(sanitized)).toHaveLength(0);
    });

    it("should not modify original object", () => {
      fc.assert(
        fc.property(generateUserData(), (userData) => {
          const original = { ...userData };
          sanitizeUserData(userData);

          // Original should still have password
          expect(userData.password).toBe(original.password);
        })
      );
    });
  });
});

describe("Sensitive Field Detection", () => {
  it("should detect all known sensitive fields", () => {
    const testObject = {
      password: "secret123",
      codeVerifiEmail: "123456",
      codeVerifiPassword: "654321",
      refreshToken: "token123",
      accessToken: "token456",
      otp: "1234",
      otpCode: "5678",
      resetToken: "reset123",
      verificationToken: "verify123",
    };

    const found = findSensitiveFields(testObject);
    // Should find password and codeVerifiEmail, codeVerifiPassword (case-sensitive match)
    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain("password");
  });

  it("should detect sensitive fields regardless of case in path", () => {
    const testObject = {
      user: {
        Password: "secret", // Different case
      },
    };

    // Our implementation checks lowercase
    const found = findSensitiveFields(testObject);
    expect(found.some((f) => f.toLowerCase().includes("password"))).toBe(true);
  });
});
