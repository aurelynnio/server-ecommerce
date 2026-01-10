/**
 * Permission System Configuration
 * Defines all permissions, resources, actions, and role-based permission mappings
 */

/**
 * All available resources in the system
 */
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
  SHIPPING: 'shipping',
  STATISTICS: 'statistics',
  CHAT: 'chat',
  SHOP_CATEGORY: 'shop-category',
  PAYMENT: 'payment',
};

/**
 * All available actions
 */
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage', // Grants all CRUD permissions
};

/**
 * Generate permission string from resource and action
 * @param {string} resource - Resource name
 * @param {string} action - Action name
 * @returns {string} Permission string in format "resource:action"
 */
const permission = (resource, action) => `${resource}:${action}`;

/**
 * Special permissions that don't follow resource:action pattern
 */
const SPECIAL_PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',
  SELLER_ACCESS: 'seller:access',
};

/**
 * All permissions organized by resource
 */
const PERMISSIONS = {
  // Special permissions
  ADMIN_ACCESS: SPECIAL_PERMISSIONS.ADMIN_ACCESS,
  SELLER_ACCESS: SPECIAL_PERMISSIONS.SELLER_ACCESS,

  // Product permissions
  PRODUCT_CREATE: permission(RESOURCES.PRODUCT, ACTIONS.CREATE),
  PRODUCT_READ: permission(RESOURCES.PRODUCT, ACTIONS.READ),
  PRODUCT_UPDATE: permission(RESOURCES.PRODUCT, ACTIONS.UPDATE),
  PRODUCT_DELETE: permission(RESOURCES.PRODUCT, ACTIONS.DELETE),
  PRODUCT_MANAGE: permission(RESOURCES.PRODUCT, ACTIONS.MANAGE),

  // Order permissions
  ORDER_CREATE: permission(RESOURCES.ORDER, ACTIONS.CREATE),
  ORDER_READ: permission(RESOURCES.ORDER, ACTIONS.READ),
  ORDER_UPDATE: permission(RESOURCES.ORDER, ACTIONS.UPDATE),
  ORDER_DELETE: permission(RESOURCES.ORDER, ACTIONS.DELETE),
  ORDER_MANAGE: permission(RESOURCES.ORDER, ACTIONS.MANAGE),

  // User permissions
  USER_CREATE: permission(RESOURCES.USER, ACTIONS.CREATE),
  USER_READ: permission(RESOURCES.USER, ACTIONS.READ),
  USER_UPDATE: permission(RESOURCES.USER, ACTIONS.UPDATE),
  USER_DELETE: permission(RESOURCES.USER, ACTIONS.DELETE),
  USER_MANAGE: permission(RESOURCES.USER, ACTIONS.MANAGE),

  // Shop permissions
  SHOP_CREATE: permission(RESOURCES.SHOP, ACTIONS.CREATE),
  SHOP_READ: permission(RESOURCES.SHOP, ACTIONS.READ),
  SHOP_UPDATE: permission(RESOURCES.SHOP, ACTIONS.UPDATE),
  SHOP_DELETE: permission(RESOURCES.SHOP, ACTIONS.DELETE),
  SHOP_MANAGE: permission(RESOURCES.SHOP, ACTIONS.MANAGE),

  // Category permissions
  CATEGORY_CREATE: permission(RESOURCES.CATEGORY, ACTIONS.CREATE),
  CATEGORY_READ: permission(RESOURCES.CATEGORY, ACTIONS.READ),
  CATEGORY_UPDATE: permission(RESOURCES.CATEGORY, ACTIONS.UPDATE),
  CATEGORY_DELETE: permission(RESOURCES.CATEGORY, ACTIONS.DELETE),
  CATEGORY_MANAGE: permission(RESOURCES.CATEGORY, ACTIONS.MANAGE),

  // Voucher permissions
  VOUCHER_CREATE: permission(RESOURCES.VOUCHER, ACTIONS.CREATE),
  VOUCHER_READ: permission(RESOURCES.VOUCHER, ACTIONS.READ),
  VOUCHER_UPDATE: permission(RESOURCES.VOUCHER, ACTIONS.UPDATE),
  VOUCHER_DELETE: permission(RESOURCES.VOUCHER, ACTIONS.DELETE),
  VOUCHER_MANAGE: permission(RESOURCES.VOUCHER, ACTIONS.MANAGE),

  // Banner permissions
  BANNER_CREATE: permission(RESOURCES.BANNER, ACTIONS.CREATE),
  BANNER_READ: permission(RESOURCES.BANNER, ACTIONS.READ),
  BANNER_UPDATE: permission(RESOURCES.BANNER, ACTIONS.UPDATE),
  BANNER_DELETE: permission(RESOURCES.BANNER, ACTIONS.DELETE),
  BANNER_MANAGE: permission(RESOURCES.BANNER, ACTIONS.MANAGE),

  // Notification permissions
  NOTIFICATION_CREATE: permission(RESOURCES.NOTIFICATION, ACTIONS.CREATE),
  NOTIFICATION_READ: permission(RESOURCES.NOTIFICATION, ACTIONS.READ),
  NOTIFICATION_UPDATE: permission(RESOURCES.NOTIFICATION, ACTIONS.UPDATE),
  NOTIFICATION_DELETE: permission(RESOURCES.NOTIFICATION, ACTIONS.DELETE),
  NOTIFICATION_MANAGE: permission(RESOURCES.NOTIFICATION, ACTIONS.MANAGE),

  // Flash Sale permissions
  FLASH_SALE_CREATE: permission(RESOURCES.FLASH_SALE, ACTIONS.CREATE),
  FLASH_SALE_READ: permission(RESOURCES.FLASH_SALE, ACTIONS.READ),
  FLASH_SALE_UPDATE: permission(RESOURCES.FLASH_SALE, ACTIONS.UPDATE),
  FLASH_SALE_DELETE: permission(RESOURCES.FLASH_SALE, ACTIONS.DELETE),
  FLASH_SALE_MANAGE: permission(RESOURCES.FLASH_SALE, ACTIONS.MANAGE),

  // Review permissions
  REVIEW_CREATE: permission(RESOURCES.REVIEW, ACTIONS.CREATE),
  REVIEW_READ: permission(RESOURCES.REVIEW, ACTIONS.READ),
  REVIEW_UPDATE: permission(RESOURCES.REVIEW, ACTIONS.UPDATE),
  REVIEW_DELETE: permission(RESOURCES.REVIEW, ACTIONS.DELETE),
  REVIEW_MANAGE: permission(RESOURCES.REVIEW, ACTIONS.MANAGE),

  // Cart permissions
  CART_CREATE: permission(RESOURCES.CART, ACTIONS.CREATE),
  CART_READ: permission(RESOURCES.CART, ACTIONS.READ),
  CART_UPDATE: permission(RESOURCES.CART, ACTIONS.UPDATE),
  CART_DELETE: permission(RESOURCES.CART, ACTIONS.DELETE),
  CART_MANAGE: permission(RESOURCES.CART, ACTIONS.MANAGE),

  // Wishlist permissions
  WISHLIST_CREATE: permission(RESOURCES.WISHLIST, ACTIONS.CREATE),
  WISHLIST_READ: permission(RESOURCES.WISHLIST, ACTIONS.READ),
  WISHLIST_UPDATE: permission(RESOURCES.WISHLIST, ACTIONS.UPDATE),
  WISHLIST_DELETE: permission(RESOURCES.WISHLIST, ACTIONS.DELETE),
  WISHLIST_MANAGE: permission(RESOURCES.WISHLIST, ACTIONS.MANAGE),

  // Shipping permissions
  SHIPPING_CREATE: permission(RESOURCES.SHIPPING, ACTIONS.CREATE),
  SHIPPING_READ: permission(RESOURCES.SHIPPING, ACTIONS.READ),
  SHIPPING_UPDATE: permission(RESOURCES.SHIPPING, ACTIONS.UPDATE),
  SHIPPING_DELETE: permission(RESOURCES.SHIPPING, ACTIONS.DELETE),
  SHIPPING_MANAGE: permission(RESOURCES.SHIPPING, ACTIONS.MANAGE),

  // Statistics permissions
  STATISTICS_READ: permission(RESOURCES.STATISTICS, ACTIONS.READ),
  STATISTICS_MANAGE: permission(RESOURCES.STATISTICS, ACTIONS.MANAGE),

  // Chat permissions
  CHAT_CREATE: permission(RESOURCES.CHAT, ACTIONS.CREATE),
  CHAT_READ: permission(RESOURCES.CHAT, ACTIONS.READ),
  CHAT_MANAGE: permission(RESOURCES.CHAT, ACTIONS.MANAGE),

  // Shop Category permissions
  SHOP_CATEGORY_CREATE: permission(RESOURCES.SHOP_CATEGORY, ACTIONS.CREATE),
  SHOP_CATEGORY_READ: permission(RESOURCES.SHOP_CATEGORY, ACTIONS.READ),
  SHOP_CATEGORY_UPDATE: permission(RESOURCES.SHOP_CATEGORY, ACTIONS.UPDATE),
  SHOP_CATEGORY_DELETE: permission(RESOURCES.SHOP_CATEGORY, ACTIONS.DELETE),
  SHOP_CATEGORY_MANAGE: permission(RESOURCES.SHOP_CATEGORY, ACTIONS.MANAGE),

  // Payment permissions
  PAYMENT_CREATE: permission(RESOURCES.PAYMENT, ACTIONS.CREATE),
  PAYMENT_READ: permission(RESOURCES.PAYMENT, ACTIONS.READ),
  PAYMENT_MANAGE: permission(RESOURCES.PAYMENT, ACTIONS.MANAGE),
};

/**
 * Default permissions for each role
 * Admin has wildcard '*' which grants all permissions
 */
const ROLE_PERMISSIONS = {
  admin: ['*'], // All permissions

  seller: [
    SPECIAL_PERMISSIONS.SELLER_ACCESS,
    // Product (own shop)
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    // Order (own shop)
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_UPDATE,
    // Shop (own)
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.SHOP_UPDATE,
    // Shipping (own shop)
    PERMISSIONS.SHIPPING_MANAGE,
    // Shop Category (own shop)
    PERMISSIONS.SHOP_CATEGORY_MANAGE,
    // Voucher (shop vouchers)
    PERMISSIONS.VOUCHER_CREATE,
    PERMISSIONS.VOUCHER_READ,
    PERMISSIONS.VOUCHER_UPDATE,
    PERMISSIONS.VOUCHER_DELETE,
    // Statistics (own shop)
    PERMISSIONS.STATISTICS_READ,
    // Chat
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    // Flash Sale (own products)
    PERMISSIONS.FLASH_SALE_CREATE,
    PERMISSIONS.FLASH_SALE_DELETE,
    // Notification (own)
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
  ],

  user: [
    // Product (read only)
    PERMISSIONS.PRODUCT_READ,
    // Cart (own)
    PERMISSIONS.CART_MANAGE,
    // Wishlist (own)
    PERMISSIONS.WISHLIST_MANAGE,
    // Order (own)
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_DELETE, // Cancel
    // Review (own)
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_UPDATE,
    PERMISSIONS.REVIEW_DELETE,
    // Notification (own)
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
    // Chat
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    // Payment
    PERMISSIONS.PAYMENT_CREATE,
  ],
};


/**
 * Get all permissions as a flat array
 * @returns {string[]} Array of all permission strings
 */
const getAllPermissionsList = () => {
  return Object.values(PERMISSIONS);
};

/**
 * Get all permissions grouped by resource
 * @returns {Object} Permissions grouped by resource
 */
const getPermissionsByResource = () => {
  const grouped = {};
  
  for (const [key, value] of Object.entries(PERMISSIONS)) {
    if (value.includes(':')) {
      const [resource] = value.split(':');
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push({ key, value });
    }
  }
  
  return grouped;
};

/**
 * Check if a permission string is valid
 * @param {string} perm - Permission string to validate
 * @returns {boolean} True if valid permission
 */
const isValidPermission = (perm) => {
  if (!perm || typeof perm !== 'string') return false;
  
  // Check if it's a wildcard
  if (perm === '*') return true;
  
  // Check if it's in the permissions list
  const allPermissions = getAllPermissionsList();
  return allPermissions.includes(perm);
};

/**
 * Validate permission format (resource:action)
 * @param {string} perm - Permission string to validate format
 * @returns {boolean} True if format is valid
 */
const isValidPermissionFormat = (perm) => {
  if (!perm || typeof perm !== 'string') return false;
  if (perm === '*') return true;
  
  const parts = perm.split(':');
  if (parts.length !== 2) return false;
  
  const [resource, action] = parts;
  return resource.length > 0 && action.length > 0;
};

/**
 * Get CRUD permissions for a resource (expand manage permission)
 * @param {string} resource - Resource name
 * @returns {string[]} Array of CRUD permission strings
 */
const getCrudPermissions = (resource) => {
  return [
    permission(resource, ACTIONS.CREATE),
    permission(resource, ACTIONS.READ),
    permission(resource, ACTIONS.UPDATE),
    permission(resource, ACTIONS.DELETE),
  ];
};

/**
 * Expand manage permissions to individual CRUD permissions
 * @param {string[]} permissions - Array of permissions
 * @returns {string[]} Expanded permissions array
 */
const expandManagePermissions = (permissions) => {
  const expanded = new Set();
  
  for (const perm of permissions) {
    expanded.add(perm);
    
    // If it's a manage permission, add all CRUD permissions
    if (perm.endsWith(':manage')) {
      const [resource] = perm.split(':');
      const crudPerms = getCrudPermissions(resource);
      crudPerms.forEach(p => expanded.add(p));
    }
  }
  
  return [...expanded];
};

/**
 * Get default permissions for a role
 * @param {string} role - Role name
 * @returns {string[]} Array of permissions for the role
 */
const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
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
  isValidPermissionFormat,
  getCrudPermissions,
  expandManagePermissions,
  getRolePermissions,
};
