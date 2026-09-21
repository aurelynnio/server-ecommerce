/**
 * Các tên sự kiện order dùng chung giữa publisher (order.service) và consumer (order.worker).
 */
const ORDER_EVENT_TYPES = {
  CREATED: 'order.created',
  STATUS_CHANGED: 'order.status_changed',
  COMMAND_CREATE: 'order.command.create',
};

module.exports = { ORDER_EVENT_TYPES };
