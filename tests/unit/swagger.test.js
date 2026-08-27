import { describe, it, expect } from 'vitest';
const openapiSpec = require('../../src/docs/openapi');
const schemas = require('../../src/docs/schemas');
const paths = require('../../src/docs/paths');

describe('Swagger & OpenAPI 3.0 Documentation Suite', () => {
  describe('OpenAPI Specification Structure', () => {
    it('should have valid openapi version and info block', () => {
      expect(openapiSpec.openapi).toBe('3.0.3');
      expect(openapiSpec.info).toBeDefined();
      expect(openapiSpec.info.title).toContain('E-Commerce');
      expect(openapiSpec.info.version).toBe('1.0.0');
    });

    it('should define essential security schemes', () => {
      const securitySchemes = openapiSpec.components?.securitySchemes;
      expect(securitySchemes).toBeDefined();
      expect(securitySchemes.bearerAuth).toBeDefined();
      expect(securitySchemes.bearerAuth.type).toBe('http');
      expect(securitySchemes.bearerAuth.scheme).toBe('bearer');
      expect(securitySchemes.cookieAuth).toBeDefined();
      expect(securitySchemes.metricsAuth).toBeDefined();
    });

    it('should define core domain data schemas', () => {
      expect(schemas.ApiResponse).toBeDefined();
      expect(schemas.ApiErrorResponse).toBeDefined();
      expect(schemas.LoginRequest).toBeDefined();
      expect(schemas.RegisterRequest).toBeDefined();
      expect(schemas.UserProfile).toBeDefined();
      expect(schemas.Address).toBeDefined();
      expect(schemas.Product).toBeDefined();
      expect(schemas.ProductVariant).toBeDefined();
      expect(schemas.CartItem).toBeDefined();
      expect(schemas.Order).toBeDefined();
      expect(schemas.ChatMessageRequest).toBeDefined();
      expect(schemas.ChatFeedbackRequest).toBeDefined();
      expect(schemas.LivenessResponse).toBeDefined();
      expect(schemas.ReadinessResponse).toBeDefined();
    });

    it('should cover all key REST API endpoints across all services', () => {
      // Auth endpoints
      expect(paths['/api/auth/register']).toBeDefined();
      expect(paths['/api/auth/login']).toBeDefined();
      expect(paths['/api/auth/logout']).toBeDefined();
      expect(paths['/api/auth/refresh-token']).toBeDefined();
      expect(paths['/api/auth/2fa/verify-login']).toBeDefined();

      // User endpoints
      expect(paths['/api/users/profile']).toBeDefined();
      expect(paths['/api/users/addresses']).toBeDefined();
      expect(paths['/api/users/upload-avatar']).toBeDefined();

      // Product endpoints
      expect(paths['/api/products']).toBeDefined();
      expect(paths['/api/products/search']).toBeDefined();
      expect(paths['/api/products/slug/{slug}']).toBeDefined();
      expect(paths['/api/products/{id}']).toBeDefined();

      // Cart & Order endpoints
      expect(paths['/api/cart']).toBeDefined();
      expect(paths['/api/cart/items']).toBeDefined();
      expect(paths['/api/orders']).toBeDefined();
      expect(paths['/api/orders/{orderId}']).toBeDefined();
      expect(paths['/api/orders/{orderId}/status']).toBeDefined();

      // Payment & Voucher endpoints
      expect(paths['/api/payment']).toBeDefined();
      expect(paths['/api/payment/vnpay-return']).toBeDefined();
      expect(paths['/api/payment/vnpay-ipn']).toBeDefined();
      expect(paths['/api/vouchers']).toBeDefined();
      expect(paths['/api/vouchers/apply']).toBeDefined();

      // Chatbot AI assistant endpoints
      expect(paths['/api/chatbot/message']).toBeDefined();
      expect(paths['/api/chatbot/stream']).toBeDefined();
      expect(paths['/api/chatbot/history/{sessionId}']).toBeDefined();
      expect(paths['/api/chatbot/feedback']).toBeDefined();
      expect(paths['/api/chatbot/status']).toBeDefined();

      // Observability & Health endpoints
      expect(paths['/health/live']).toBeDefined();
      expect(paths['/health/ready']).toBeDefined();
      expect(paths['/metrics']).toBeDefined();
    });

    it('should have valid HTTP operations with tags and responses', () => {
      const endpoints = Object.entries(paths);
      expect(endpoints.length).toBeGreaterThan(30);

      for (const [pathKey, methods] of endpoints) {
        for (const [method, operation] of Object.entries(methods)) {
          expect(['get', 'post', 'put', 'patch', 'delete']).toContain(method.toLowerCase());
          expect(operation.tags).toBeInstanceOf(Array);
          expect(operation.tags.length).toBeGreaterThan(0);
          expect(operation.summary).toBeDefined();
          expect(operation.responses).toBeDefined();
        }
      }
    });
  });
});

