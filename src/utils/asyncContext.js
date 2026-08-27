const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Get current Request/Trace ID from active asynchronous execution context
 * @returns {string|undefined}
 */
const getRequestId = () => {
  const store = asyncLocalStorage.getStore();
  return store?.requestId;
};

/**
 * Get the full current context store
 * @returns {Object|undefined}
 */
const getStore = () => asyncLocalStorage.getStore();

/**
 * Run a callback function within an AsyncLocalStorage context
 * @param {Object} context
 * @param {Function} callback
 * @returns {*}
 */
const runWithContext = (context, callback) => {
  return asyncLocalStorage.run(context, callback);
};

module.exports = {
  asyncLocalStorage,
  getRequestId,
  getStore,
  runWithContext,
};
