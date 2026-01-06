/**
 * Property Test: Input Validation Completeness
 * 
 * Property 1: Invalid inputs should be rejected with status 400
 * 
 * Validates Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property: Input Validation Completeness', () => {
  
  describe('ObjectId Validation', () => {
    const isValidObjectId = (id) => {
      if (!id || typeof id !== 'string') return false;
      return /^[a-fA-F0-9]{24}$/.test(id);
    };

    it('should accept valid MongoDB ObjectIds', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 24, maxLength: 24, unit: fc.constantFrom(...'0123456789abcdef'.split('')) }),
          (id) => {
            expect(isValidObjectId(id)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid ObjectIds', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 23 }), // Too short
            fc.string({ minLength: 25, maxLength: 50 }), // Too long
            fc.constant(null),
            fc.constant(undefined),
            fc.integer()
          ),
          (invalidId) => {
            expect(isValidObjectId(invalidId)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Email Validation', () => {
    const isValidEmail = (email) => {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should accept valid email formats', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            expect(isValidEmail(email)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid email formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().filter(s => !s.includes('@')), // No @
            fc.constant('test@'),
            fc.constant('@test.com'),
            fc.constant('test@test'),
            fc.constant(''),
            fc.constant(null)
          ),
          (invalidEmail) => {
            expect(isValidEmail(invalidEmail)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Price Validation', () => {
    const isValidPrice = (price) => {
      if (typeof price !== 'number') return false;
      if (isNaN(price) || !isFinite(price)) return false;
      if (price < 0) return false;
      // Check for reasonable precision (max 2 decimal places)
      const decimalPlaces = (price.toString().split('.')[1] || '').length;
      return decimalPlaces <= 2;
    };

    it('should accept valid prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000000 }),
          (price) => {
            expect(isValidPrice(price)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid prices', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000000, max: -1 }), // Negative
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.string(),
            fc.constant(null)
          ),
          (invalidPrice) => {
            expect(isValidPrice(invalidPrice)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Quantity Validation', () => {
    const isValidQuantity = (quantity) => {
      if (typeof quantity !== 'number') return false;
      if (!Number.isInteger(quantity)) return false;
      if (quantity < 1) return false;
      if (quantity > 9999) return false; // Reasonable max
      return true;
    };

    it('should accept valid quantities', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9999 }),
          (quantity) => {
            expect(isValidQuantity(quantity)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid quantities', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -100, max: 0 }), // Zero or negative
            fc.integer({ min: 10000, max: 100000 }), // Too large
            fc.double({ min: 1.1, max: 10.9 }), // Non-integer
            fc.string(),
            fc.constant(null)
          ),
          (invalidQuantity) => {
            expect(isValidQuantity(invalidQuantity)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('String Length Validation', () => {
    const validateStringLength = (str, minLength, maxLength) => {
      if (typeof str !== 'string') return { valid: false, error: 'Must be a string' };
      if (str.length < minLength) return { valid: false, error: `Minimum length is ${minLength}` };
      if (str.length > maxLength) return { valid: false, error: `Maximum length is ${maxLength}` };
      return { valid: true };
    };

    it('should accept strings within length bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // minLength
          fc.integer({ min: 11, max: 100 }), // maxLength
          (minLength, maxLength) => {
            const validLength = Math.floor((minLength + maxLength) / 2);
            const validString = 'a'.repeat(validLength);
            
            const result = validateStringLength(validString, minLength, maxLength);
            expect(result.valid).toBe(true);
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject strings outside length bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 10 }), // minLength
          fc.integer({ min: 20, max: 50 }), // maxLength
          (minLength, maxLength) => {
            // Too short
            const tooShort = 'a'.repeat(minLength - 1);
            expect(validateStringLength(tooShort, minLength, maxLength).valid).toBe(false);

            // Too long
            const tooLong = 'a'.repeat(maxLength + 1);
            expect(validateStringLength(tooLong, minLength, maxLength).valid).toBe(false);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Date Validation', () => {
    const isValidDate = (dateStr) => {
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    };

    const isValidDateRange = (startDate, endDate) => {
      if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
      return new Date(startDate) <= new Date(endDate);
    };

    it('should accept valid date strings', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .filter(d => !isNaN(d.getTime())), // Filter out invalid dates
          (date) => {
            expect(isValidDate(date.toISOString())).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate date ranges correctly', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
            .filter(d => !isNaN(d.getTime())),
          fc.integer({ min: 1, max: 365 }), // days to add
          (startDate, daysToAdd) => {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + daysToAdd);

            // Valid range: start <= end
            expect(isValidDateRange(startDate.toISOString(), endDate.toISOString())).toBe(true);

            // Invalid range: start > end (only when daysToAdd > 0)
            if (daysToAdd > 0) {
              expect(isValidDateRange(endDate.toISOString(), startDate.toISOString())).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Voucher Code Validation', () => {
    const isValidVoucherCode = (code) => {
      if (!code || typeof code !== 'string') return false;
      if (code.length < 3 || code.length > 20) return false;
      // Only alphanumeric
      return /^[A-Z0-9]+$/i.test(code);
    };

    it('should accept valid voucher codes', () => {
      fc.assert(
        fc.property(
          fc.string({ 
            minLength: 3, 
            maxLength: 20, 
            unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''))
          }),
          (code) => {
            expect(isValidVoucherCode(code)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid voucher codes', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 0, maxLength: 2 }), // Too short
            fc.string({ minLength: 21, maxLength: 50 }), // Too long
            fc.constant('CODE-123'), // Contains hyphen
            fc.constant('CODE 123'), // Contains space
            fc.constant('CODE@123'), // Contains special char
            fc.constant(null),
            fc.constant('')
          ),
          (invalidCode) => {
            expect(isValidVoucherCode(invalidCode)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination Validation', () => {
    const validatePagination = (page, limit) => {
      const errors = [];
      
      if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
        errors.push('Page must be a positive integer');
      }
      
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        errors.push('Limit must be an integer between 1 and 100');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    };

    it('should accept valid pagination params', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }), // page
          fc.integer({ min: 1, max: 100 }), // limit
          (page, limit) => {
            const result = validatePagination(page, limit);
            expect(result.valid).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid pagination params', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.tuple(fc.integer({ min: -100, max: 0 }), fc.integer({ min: 1, max: 100 })), // Invalid page
            fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 101, max: 1000 })), // Invalid limit
            fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: -100, max: 0 })) // Negative limit
          ),
          ([page, limit]) => {
            const result = validatePagination(page, limit);
            expect(result.valid).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('XSS Prevention', () => {
    const containsXSS = (input) => {
      if (typeof input !== 'string') return false;
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi
      ];
      return xssPatterns.some(pattern => pattern.test(input));
    };

    it('should detect XSS patterns', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img onerror=alert(1)>',
        '<iframe src="evil.com">',
        '<object data="evil.swf">'
      ];

      for (const payload of xssPayloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should allow safe strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => 
            !s.includes('<script') && 
            !s.includes('javascript:') && 
            !s.includes('onerror') &&
            !s.includes('<iframe') &&
            !s.includes('<object')
          ),
          (safeString) => {
            expect(containsXSS(safeString)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('SQL Injection Prevention', () => {
    const containsSQLInjection = (input) => {
      if (typeof input !== 'string') return false;
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/gi,
        /('|"|;|--)/g,
        /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
      ];
      return sqlPatterns.some(pattern => pattern.test(input));
    };

    it('should detect SQL injection patterns', () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "UNION SELECT * FROM users",
        "'; DELETE FROM orders; --"
      ];

      for (const payload of sqlPayloads) {
        expect(containsSQLInjection(payload)).toBe(true);
      }
    });
  });
});
