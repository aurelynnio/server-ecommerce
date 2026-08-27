/**
 * OpenAPI 3.0 Paths: Monitoring, Liveness, Readiness & Prometheus Metrics
 */

module.exports = {
  '/health/live': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Kubernetes / Container Liveness Probe',
      description: 'Checks if the Node.js event loop and process are running.',
      responses: {
        200: {
          description: 'Server process is alive',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LivenessResponse' } } },
        },
      },
    },
  },
  '/health/ready': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Kubernetes / Load Balancer Readiness Probe',
      description: 'Verifies MongoDB, Redis, and RabbitMQ dependencies. Cached in RAM for 10s to prevent database hammering.',
      responses: {
        200: {
          description: 'All vital dependencies operational',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessResponse' } } },
        },
        503: { description: 'One or more required services are down' },
      },
    },
  },
  '/metrics': {
    get: {
      tags: ['Monitoring & Health'],
      summary: 'Prometheus metrics scrape endpoint',
      description: 'Exports RED metrics (rate, errors, duration), GC metrics, heap memory, and multi-worker aggregated metrics.',
      security: [{ metricsAuth: [] }],
      responses: {
        200: {
          description: 'Prometheus metric text',
          content: { 'text/plain; version=0.0.4': {} },
        },
        403: { description: 'Forbidden if unauthorized in production' },
      },
    },
  },
};

