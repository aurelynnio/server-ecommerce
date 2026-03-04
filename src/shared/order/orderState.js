const ORDER_ACTORS = {
  ADMIN: 'admin',
  SELLER: 'seller',
  USER: 'user',
};

const ORDER_TRANSITIONS = {
  [ORDER_ACTORS.ADMIN]: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
    returned: [],
  },
  [ORDER_ACTORS.SELLER]: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
    returned: [],
  },
  [ORDER_ACTORS.USER]: {
    pending: ['cancelled'],
    confirmed: ['cancelled'],
    processing: [],
    shipped: [],
    delivered: [],
    cancelled: [],
    returned: [],
  },
};

const normalizeActor = (actor) => (ORDER_TRANSITIONS[actor] ? actor : ORDER_ACTORS.ADMIN);

const getAllowedTransitions = (currentStatus, actor = ORDER_ACTORS.ADMIN) => {
  const normalizedActor = normalizeActor(actor);
  return ORDER_TRANSITIONS[normalizedActor][currentStatus] || [];
};

const canTransition = (currentStatus, nextStatus, actor = ORDER_ACTORS.ADMIN) =>
  getAllowedTransitions(currentStatus, actor).includes(nextStatus);

module.exports = {
  ORDER_ACTORS,
  getAllowedTransitions,
  canTransition,
};
