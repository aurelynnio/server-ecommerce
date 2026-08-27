const client = require('prom-client');
const cluster = require('cluster');
const crypto = require('crypto');

// Use global default registry for automatic prom-client IPC worker support
const register = client.register;

// Automatically collect process runtime metrics (Event loop lag, Heap, RSS, GC, CPU)
client.collectDefaultMetrics({ register, prefix: 'nodejs_' });

const pendingClusterRequests = new Map();

// If running in cluster worker process, listen for aggregated cluster responses from master
if (cluster.isWorker) {
  process.on('message', (message) => {
    if (message && message.type === 'CLUSTER_METRICS_RESPONSE') {
      const pending = pendingClusterRequests.get(message.requestId);
      if (pending) {
        pendingClusterRequests.delete(message.requestId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve({
            metrics: message.metrics,
            contentType: message.contentType || register.contentType,
          });
        }
      }
    }
  });
}

/**
 * Returns Prometheus metrics payload.
 * When Node.js cluster is active, requests the primary process to aggregate
 * metrics across all worker processes using prom-client AggregatorRegistry.
 *
 * @returns {Promise<{metrics: string, contentType: string}>}
 */
const getAggregatedMetrics = async () => {
  const isClusterActive =
    cluster.isWorker &&
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_CLUSTER !== 'false' &&
    typeof process.send === 'function';

  if (isClusterActive) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        pendingClusterRequests.delete(requestId);
        // Fallback gracefully to local worker metrics on timeout
        register
          .metrics()
          .then((m) => resolve({ metrics: m, contentType: register.contentType }))
          .catch(reject);
      }, 5000);

      pendingClusterRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      process.send({ type: 'GET_CLUSTER_METRICS', requestId });
    });
  }

  return {
    metrics: await register.metrics(),
    contentType: register.contentType,
  };
};

module.exports = {
  client,
  register,
  getAggregatedMetrics,
};
