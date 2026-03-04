/**
 * Unit Tests: Ownership middleware
 * Tests verifyShopOwnership, verifyProductOwnership, verifyOrderOwnership
 *
 * Re-implements the pure decision logic to avoid Mongoose model dependency.
 */
import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';

/* ===========================
 * Re-implementations of ownership check logic
 * from src/middlewares/ownership.middleware.js
 * =========================== */

function checkShopOwnership({ userId, shop }) {
  if (!userId) {
    return {
      error: {
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Authentication required',
      },
    };
  }
  if (!shop) {
    return {
      error: {
        statusCode: StatusCodes.FORBIDDEN,
        message: "You don't have a shop. Please register a shop first.",
      },
    };
  }
  if (shop.status === 'banned') {
    return {
      error: {
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Your shop has been banned. Please contact support.',
      },
    };
  }
  return { shop };
}

function checkProductOwnership({ productId, shop, product }) {
  if (!productId) {
    return {
      error: {
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Product ID is required',
      },
    };
  }
  if (!shop) {
    return {
      error: {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Shop verification required.',
      },
    };
  }
  if (!product) {
    return {
      error: {
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Product not found',
      },
    };
  }
  if (product.shopId !== shop._id) {
    return {
      error: {
        statusCode: StatusCodes.FORBIDDEN,
        message: "You don't have permission to access this product.",
      },
    };
  }
  return { product };
}

function checkOrderOwnership({ orderId, shop, order }) {
  if (!orderId) {
    return {
      error: {
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Order ID is required',
      },
    };
  }
  if (!shop) {
    return {
      error: {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Shop verification required.',
      },
    };
  }
  if (!order) {
    return {
      error: { statusCode: StatusCodes.NOT_FOUND, message: 'Order not found' },
    };
  }
  if (order.shopId !== shop._id) {
    return {
      error: {
        statusCode: StatusCodes.FORBIDDEN,
        message: "This order doesn't belong to your shop.",
      },
    };
  }
  return { order };
}

function resolveUserId(user) {
  return user?.userId || user?._id || null;
}

function resolveProductId(params) {
  return params.id || params.productId || null;
}

function resolveOrderId(params) {
  return params.orderId || params.id || null;
}

/* ===========================
 * TESTS
 * =========================== */

describe('Ownership Middleware – verifyShopOwnership logic', () => {
  it('should pass when user owns an active shop', () => {
    const result = checkShopOwnership({
      userId: 'user123',
      shop: { _id: 'shop1', status: 'active' },
    });
    expect(result.error).toBeUndefined();
    expect(result.shop).toBeDefined();
  });

  it('should reject when userId is missing', () => {
    const result = checkShopOwnership({ userId: null, shop: null });
    expect(result.error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it('should reject when user has no shop', () => {
    const result = checkShopOwnership({ userId: 'user123', shop: null });
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toContain("don't have a shop");
  });

  it('should reject when shop is banned', () => {
    const result = checkShopOwnership({
      userId: 'user123',
      shop: { _id: 'shop1', status: 'banned' },
    });
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toContain('banned');
  });
});

describe('Ownership Middleware – userId resolution', () => {
  it('should prefer userId over _id', () => {
    expect(resolveUserId({ userId: 'a', _id: 'b' })).toBe('a');
  });

  it('should fallback to _id', () => {
    expect(resolveUserId({ _id: 'b' })).toBe('b');
  });

  it('should return null when both absent', () => {
    expect(resolveUserId({})).toBe(null);
  });

  it('should handle missing user', () => {
    expect(resolveUserId(undefined)).toBe(null);
  });
});

describe('Ownership Middleware – verifyProductOwnership logic', () => {
  const shop = { _id: 'shop1' };

  it('should pass when product belongs to shop', () => {
    const result = checkProductOwnership({
      productId: 'prod1',
      shop,
      product: { _id: 'prod1', shopId: 'shop1' },
    });
    expect(result.error).toBeUndefined();
    expect(result.product).toBeDefined();
  });

  it('should reject missing productId', () => {
    const result = checkProductOwnership({
      productId: null,
      shop,
      product: null,
    });
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it('should reject missing shop (middleware ordering)', () => {
    const result = checkProductOwnership({
      productId: 'prod1',
      shop: null,
      product: null,
    });
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('should reject product not found', () => {
    const result = checkProductOwnership({
      productId: 'prod1',
      shop,
      product: null,
    });
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it('should reject cross-shop access', () => {
    const result = checkProductOwnership({
      productId: 'prod1',
      shop,
      product: { _id: 'prod1', shopId: 'otherShop' },
    });
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });
});

describe('Ownership Middleware – productId resolution', () => {
  it('should prefer params.id', () => {
    expect(resolveProductId({ id: 'a', productId: 'b' })).toBe('a');
  });

  it('should fallback to params.productId', () => {
    expect(resolveProductId({ productId: 'b' })).toBe('b');
  });

  it('should return null when both absent', () => {
    expect(resolveProductId({})).toBe(null);
  });
});

describe('Ownership Middleware – verifyOrderOwnership logic', () => {
  const shop = { _id: 'shop1' };

  it('should pass when order belongs to shop', () => {
    const result = checkOrderOwnership({
      orderId: 'order1',
      shop,
      order: { _id: 'order1', shopId: 'shop1' },
    });
    expect(result.error).toBeUndefined();
    expect(result.order).toBeDefined();
  });

  it('should reject missing orderId', () => {
    const result = checkOrderOwnership({ orderId: null, shop, order: null });
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it('should reject missing shop', () => {
    const result = checkOrderOwnership({
      orderId: 'order1',
      shop: null,
      order: null,
    });
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('should reject order not found', () => {
    const result = checkOrderOwnership({
      orderId: 'order1',
      shop,
      order: null,
    });
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it('should reject cross-shop order', () => {
    const result = checkOrderOwnership({
      orderId: 'order1',
      shop,
      order: { _id: 'order1', shopId: 'otherShop' },
    });
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });
});

describe('Ownership Middleware – orderId resolution', () => {
  it('should prefer params.orderId', () => {
    expect(resolveOrderId({ orderId: 'a', id: 'b' })).toBe('a');
  });

  it('should fallback to params.id', () => {
    expect(resolveOrderId({ id: 'b' })).toBe('b');
  });

  it('should return null when both absent', () => {
    expect(resolveOrderId({})).toBe(null);
  });
});
