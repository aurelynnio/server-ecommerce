/**
 * k6 load test cho chatbot streaming endpoint.
 *
 * Chạy:
 *   k6 run --out json=load-test.json tests/load/chatbot-load.js
 *
 * Pre-req: server đang chạy ở BASE_URL và MISTRAL_API_KEY đã set.
 *
 * Mục tiêu (ghi vào thresholds):
 *   - p95 latency < 5s
 *   - error rate < 1%
 *   - 200 concurrent VUs, ramp up 2 phút, hold 3 phút
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const STREAM_PATH = '/api/chatbot/stream';
const MESSAGE = __ENV.TEST_MESSAGE || 'Tìm áo thun nam dưới 300k';

const streamLatency = new Trend('chatbot_stream_latency_ms', true);
const errorRate = new Rate('chatbot_errors');
const tokenCount = new Counter('chatbot_streamed_chars');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{endpoint:chatbot_stream}': ['p(95)<5000'],
    chatErrors: ['rate<0.01'],
    'chatbot_stream_latency_ms': ['p(95)<5000'],
  },
};

export default function () {
  const url = `${BASE_URL}${STREAM_PATH}`;
  const body = JSON.stringify({ message: MESSAGE });
  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'chatbot_stream' },
  };

  const start = Date.now();
  const res = http.post(url, body, params);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has data:': (r) => r.body && r.body.includes('data:'),
  });
  errorRate.add(!ok);

  streamLatency.add(Date.now() - start);
  tokenCount.add((res.body || '').length);

  sleep(0.5);
}
