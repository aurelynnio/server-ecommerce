const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const chatbotRequestsTotal = new client.Counter({
  name: 'chatbot_requests_total',
  help: 'Total chatbot requests',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

const chatbotLatencySeconds = new client.Histogram({
  name: 'chatbot_latency_seconds',
  help: 'Chatbot end-to-end latency in seconds',
  labelNames: ['endpoint', 'stream', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

const chatbotTokensTotal = new client.Counter({
  name: 'chatbot_tokens_total',
  help: 'Total tokens consumed (estimated from chars)',
  labelNames: ['direction'],
  registers: [register],
});

const chatbotErrorsTotal = new client.Counter({
  name: 'chatbot_errors_total',
  help: 'Total chatbot errors by stage',
  labelNames: ['stage'],
  registers: [register],
});

const chatbotHallucinationTotal = new client.Counter({
  name: 'chatbot_hallucination_total',
  help: 'Total grounded responses that were replaced by safe fallback',
  labelNames: ['kind'],
  registers: [register],
});

// Helper: ước lượng token từ content (xem utils/tokenBudget.js)
const CHARS_PER_TOKEN = 3;
const estimateTokens = (text = '') => Math.ceil(String(text).length / CHARS_PER_TOKEN);

const metrics = {
  register,
  chatbotRequestsTotal,
  chatbotLatencySeconds,
  chatbotTokensTotal,
  chatbotErrorsTotal,
  chatbotHallucinationTotal,
  estimateTokens,
};

module.exports = metrics;
