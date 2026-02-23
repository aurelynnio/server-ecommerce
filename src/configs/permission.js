const RESOURCES = {
  PRODUCT: "product",
  ORDER: "order",
  USER: "user",
  SHOP: "shop",
  CATEGORY: "category",
  VOUCHER: "voucher",
  BANNER: "banner",
  NOTIFICATION: "notification",
  FLASH_SALE: "flash-sale",
  REVIEW: "review",
  CART: "cart",
  WISHLIST: "wishlist",
  SHIPPING: "shipping",
  STATISTICS: "statistics",
  CHAT: "chat",
  SHOP_CATEGORY: "shop-category",
  PAYMENT: "payment",
};

const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  MANAGE: "manage",
};

const permission = (resource, action) => `${resource}:${action}`;

const SPECIAL_PERMISSIONS = {
  ADMIN_ACCESS: "admin:access",
  SELLER_ACCESS: "seller:access",
};

const buildPermissions = () => {
  const generated = {};

  for (const [resourceKey, resourceValue] of Object.entries(RESOURCES)) {
    for (const [actionKey, actionValue] of Object.entries(ACTIONS)) {
      generated[`${resourceKey}_${actionKey}`] = permission(
        resourceValue,
        actionValue,
      );
    }
  }

  return generated;
};

const PERMISSIONS = {
  ...buildPermissions(),
  ADMIN_ACCESS: SPECIAL_PERMISSIONS.ADMIN_ACCESS,
  SELLER_ACCESS: SPECIAL_PERMISSIONS.SELLER_ACCESS,
};

const ROLE_PERMISSIONS = {
  admin: ["*"],
  seller: [
    SPECIAL_PERMISSIONS.SELLER_ACCESS,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.SHOP_UPDATE,
    PERMISSIONS.SHIPPING_MANAGE,
    PERMISSIONS.SHOP_CATEGORY_MANAGE,
    PERMISSIONS.VOUCHER_CREATE,
    PERMISSIONS.VOUCHER_READ,
    PERMISSIONS.VOUCHER_UPDATE,
    PERMISSIONS.VOUCHER_DELETE,
    PERMISSIONS.STATISTICS_READ,
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    PERMISSIONS.FLASH_SALE_CREATE,
    PERMISSIONS.FLASH_SALE_DELETE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
  ],
  user: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.CART_MANAGE,
    PERMISSIONS.WISHLIST_MANAGE,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_READ,
    PERMISSIONS.REVIEW_UPDATE,
    PERMISSIONS.REVIEW_DELETE,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_UPDATE,
    PERMISSIONS.CHAT_CREATE,
    PERMISSIONS.CHAT_READ,
    PERMISSIONS.PAYMENT_CREATE,
  ],
};

const getAllPermissionsList = () => [...new Set(Object.values(PERMISSIONS))];

const ALL_PERMISSIONS_SET = new Set(getAllPermissionsList());

const getPermissionsByResource = () => {
  const grouped = {};

  for (const value of Object.values(PERMISSIONS)) {
    if (!value.includes(":")) continue;
    const [resource] = value.split(":");

    if (!grouped[resource]) {
      grouped[resource] = [];
    }
    grouped[resource].push(value);
  }

  return grouped;
};

const isValidPermission = (perm) => {
  if (!perm || typeof perm !== "string") return false;
  if (perm === "*") return true;
  return ALL_PERMISSIONS_SET.has(perm);
};

const expandManagePermissions = (permissions) => {
  const expanded = new Set();

  for (const perm of permissions) {
    expanded.add(perm);
    if (!perm.endsWith(":manage")) continue;

    const [resource] = perm.split(":");
    expanded.add(permission(resource, ACTIONS.CREATE));
    expanded.add(permission(resource, ACTIONS.READ));
    expanded.add(permission(resource, ACTIONS.UPDATE));
    expanded.add(permission(resource, ACTIONS.DELETE));
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
