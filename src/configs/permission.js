const RESOURCES = {
  PRODUCT: 'product',
  ORDER: 'order',
  USER: 'user',
  SHOP: 'shop',
  CATEGORY: 'category',
  VOUCHER: 'voucher',
  BANNER: 'banner',
  NOTIFICATION: 'notification',
  FLASH_SALE: 'flash-sale',
  REVIEW: 'review',
  CART: 'cart',
  WISHLIST: 'wishlist',
  STATISTICS: 'statistics',
  CHAT: 'chat',
  SHOP_CATEGORY: 'shop-category',
  PAYMENT: 'payment',
};

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
};

const permission = (resource, action) => `${resource}:${action}`;

const SPECIAL_PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',
  SELLER_ACCESS: 'seller:access',
};

// Generate lookup dictionary (16 resources * 5 actions + 2 special permissions = 82)
const PERMISSIONS = Object.entries(RESOURCES).reduce(
  (acc, [resKey, resVal]) => {
    Object.entries(ACTIONS).forEach(([actKey, actVal]) => {
      acc[`${resKey}_${actKey}`] = permission(resVal, actVal);
    });
    return acc;
  },
  {
    ADMIN_ACCESS: SPECIAL_PERMISSIONS.ADMIN_ACCESS,
    SELLER_ACCESS: SPECIAL_PERMISSIONS.SELLER_ACCESS,
  },
);

// Declarative role permission defaults — clean, grouped, and readable at a glance
const ROLE_PERMISSIONS = {
  admin: ['*'],
  seller: [
    SPECIAL_PERMISSIONS.SELLER_ACCESS,
    'product:create',
    'product:read',
    'product:update',
    'product:delete',
    'order:read',
    'order:update',
    'shop:read',
    'shop:update',
    'shop-category:manage',
    'voucher:create',
    'voucher:read',
    'voucher:update',
    'voucher:delete',
    'statistics:read',
    'chat:create',
    'chat:read',
    'flash-sale:create',
    'flash-sale:delete',
    'notification:read',
    'notification:update',
  ],
  user: [
    'product:read',
    'cart:manage',
    'wishlist:manage',
    'order:create',
    'order:read',
    'order:delete',
    'review:create',
    'review:read',
    'review:update',
    'review:delete',
    'notification:read',
    'notification:update',
    'chat:create',
    'chat:read',
    'payment:create',
  ],
};

const ALL_PERMISSIONS_LIST = [...new Set(Object.values(PERMISSIONS))];
const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS_LIST);

const getAllPermissionsList = () => ALL_PERMISSIONS_LIST;

const getPermissionsByResource = () => {
  const grouped = {};
  for (const perm of ALL_PERMISSIONS_SET) {
    if (!perm.includes(':')) continue;
    const [resource] = perm.split(':');
    (grouped[resource] ||= []).push(perm);
  }
  return grouped;
};

const isValidPermission = (perm) => {
  if (!perm || typeof perm !== 'string') return false;
  return perm === '*' || ALL_PERMISSIONS_SET.has(perm);
};

const expandManagePermissions = (permissions) => {
  const expanded = new Set();
  for (const perm of permissions) {
    expanded.add(perm);
    if (perm.endsWith(':manage')) {
      const [resource] = perm.split(':');
      expanded.add(`${resource}:create`);
      expanded.add(`${resource}:read`);
      expanded.add(`${resource}:update`);
      expanded.add(`${resource}:delete`);
    }
  }
  return [...expanded];
};

const getRolePermissions = (role) => {
  const roles = Array.isArray(role) ? role : [role];
  return [...new Set(roles.flatMap((item) => ROLE_PERMISSIONS[item] || []))];
};

module.exports = {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  SPECIAL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permission,
  getAllPermissionsList,
  getPermissionsByResource,
  isValidPermission,
  expandManagePermissions,
  getRolePermissions,
};
