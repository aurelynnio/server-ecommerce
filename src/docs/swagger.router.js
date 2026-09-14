/**
 * Swagger UI Express Router
 * Serves interactive OpenAPI 3.0 documentation and raw JSON spec
 */

const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi');

const customOptions = {
  customSiteTitle: 'E-Commerce & AI Assistant API Documentation',
  customCss: `
    .swagger-ui .topbar { background-color: #0f172a; padding: 12px 0; border-bottom: 2px solid #3b82f6; }
    .swagger-ui .topbar .link { color: #f8fafc; font-weight: 700; font-size: 1.25rem; text-decoration: none; }
    .swagger-ui .info { margin: 25px 0; }
    .swagger-ui .info .title { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto; color: #0f172a; }
    .swagger-ui .scheme-container { background: #f8fafc; box-shadow: none; border-bottom: 1px solid #e2e8f0; padding: 15px 0; }
    .swagger-ui .btn.authorize { background-color: #2563eb; color: #fff; border-color: #2563eb; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    displayRequestDuration: true,
    tagsSorter: 'alpha',
  },
};

// Serve raw JSON spec endpoint for tooling, Postman, and client generation
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(openapiSpec);
});

// Serve interactive Swagger UI documentation
router.use('/', swaggerUi.serve, swaggerUi.setup(openapiSpec, customOptions));

module.exports = router;
