const normalizeRoles = (roleOrRoles) => {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.filter(Boolean);
  }

  return roleOrRoles ? [roleOrRoles] : [];
};

const getRequestUserRoles = (user) => {
  if (!user) return [];

  return [...new Set([...normalizeRoles(user.role), ...normalizeRoles(user.roles)])];
};

const isRequestUserAdmin = (user) => getRequestUserRoles(user).includes('admin');

const getRequestUserId = (user) => user?.userId || user?._id || null;

module.exports = {
  normalizeRoles,
  getRequestUserRoles,
  isRequestUserAdmin,
  getRequestUserId,
};
