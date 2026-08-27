/**
 * OpenAPI 3.0.3 Specification Object
 * Central configuration and schema definition
 */

const schemas = require('./schemas');
const paths = require('./paths');

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'E-Commerce & AI Shopping Assistant API',
    version: '1.0.0',
    description: `
## E-Commerce & AI Assistant Backend REST API Documentation

Comprehensive API documentation for the E-Commerce platform and AI Shopping Assistant.

### Architecture Highlights:
- **Authentication**: JWT access & refresh tokens in httpOnly cookies, 2FA OTP email verification, and password reset flows.
- **E-Commerce Domain**: Multi-tier product variants, category hierarchies, multi-vendor shops, cart calculations, order lifecycles, and VNPay gateway.
- **AI Shopping Assistant**: RAG + Tool-calling architecture powered by Mistral AI, conversational memory, SSE token streaming (\`/api/chatbot/stream\`), and anti-hallucination guardrails.
- **Observability**: Prometheus metrics (\`/metrics\`), liveness probe (\`/health/live\`), readiness probe (\`/health/ready\`), and distributed tracing with \`X-Request-Id\`.
    `,
    contact: {
      name: 'E-Commerce Engineering Team',
      email: 'engineering@ecommerce.local',
    },
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server (Port 5000)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Alternative Port (Port 3000)',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication, registration, OTP email verification, 2FA, and password management' },
    { name: 'Users', description: 'User profiles, delivery addresses, and admin user administration' },
    { name: 'Products', description: 'Public catalog, category browsing, variant management, and seller operations' },
    { name: 'Categories', description: 'Product categories and catalog hierarchy' },
    { name: 'Banners', description: 'Hero promotional banners' },
    { name: 'Shops', description: 'Multi-vendor shop registration, seller profiles, and settings' },
    { name: 'Shipping', description: 'Shipping rates, carriers, and delivery templates' },
    { name: 'Cart', description: 'Shopping cart and line item operations' },
    { name: 'Orders', description: 'Order checkout, status fulfillment, and seller/admin listing' },
    { name: 'Payment', description: 'VNPay payment gateway integration, return URL, and IPN callbacks' },
    { name: 'Vouchers', description: 'Discounts, coupon codes, and checkout voucher application' },
    { name: 'Wishlist', description: 'Saved favorite products' },
    { name: 'Reviews', description: 'Product reviews, ratings, and customer feedback' },
    { name: 'Notifications', description: 'In-app notification feeds' },
    { name: 'Newsletter', description: 'Email newsletter subscriptions' },
    { name: 'Search & Discovery', description: 'Product search autocomplete, semantic search, and recommendations' },
    { name: 'Flash Sale', description: 'Time-limited flash sale events and discounted items' },
    { name: 'Statistics', description: 'Revenue analytics, order metrics, and business dashboards' },
    { name: 'Settings', description: 'Global platform configurations' },
    { name: 'Permissions', description: 'Role-Based Access Control (RBAC) and permission matrices' },
    { name: 'Chat', description: 'Real-time peer-to-peer customer-to-shop messaging' },
    { name: 'Chatbot', description: 'AI Shopping Assistant with tool-calling, SSE streaming, and session history' },
    { name: 'Monitoring & Health', description: 'System liveness, dependency readiness probes, and Prometheus metrics' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token (e.g. `Bearer eyJhbGci...`)',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description: 'Access token sent via httpOnly cookie',
      },
      metricsAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Bearer token for scraping /metrics endpoint in production',
      },
    },
    schemas,
  },
  paths,
};

module.exports = openapi;
