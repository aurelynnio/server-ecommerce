/**
 * Unit Tests: Product Model – Virtuals & Hooks logic
 * Tests: onSale, isActive, effectivePrice virtuals
 * and slug generation / stock aggregation hooks
 *
 * We re-implement the pure logic (no Mongoose dependency needed).
 */
import { describe, it, expect } from 'vitest';

/* ===========================
 * Re-implementations of virtual getters
 * =========================== */

function getOnSale(product) {
  if (product.flashSale?.isActive) {
    const now = new Date();
    return product.flashSale.startTime <= now && product.flashSale.endTime > now;
  }
  return (
    product.price?.discountPrice != null && product.price.discountPrice < product.price.currentPrice
  );
}

function getIsActive(product) {
  return product.status === 'published';
}

function getEffectivePrice(product) {
  if (product.flashSale?.isActive) {
    const now = new Date();
    if (product.flashSale.startTime <= now && product.flashSale.endTime > now) {
      return product.flashSale.salePrice;
    }
  }
  return product.price?.discountPrice || product.price?.currentPrice;
}

/**
 * Re-implementation of stock/soldCount aggregation (pre-save hook)
 */
function aggregateVariants(variants) {
  const stock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const soldCount = variants.reduce((sum, v) => sum + (v.sold || 0), 0);
  return { stock, soldCount };
}

/* ===========================
 * TESTS
 * =========================== */

describe('Product Model – onSale virtual', () => {
  it('should return true when flashSale is active and within time range', () => {
    const product = {
      flashSale: {
        isActive: true,
        startTime: new Date(Date.now() - 3600000), // 1h ago
        endTime: new Date(Date.now() + 3600000), // 1h from now
      },
      price: { currentPrice: 100000 },
    };
    expect(getOnSale(product)).toBe(true);
  });

  it('should return false when flashSale is active but expired', () => {
    const product = {
      flashSale: {
        isActive: true,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 3600000), // ended 1h ago
      },
      price: { currentPrice: 100000 },
    };
    expect(getOnSale(product)).toBe(false);
  });

  it('should return false when flashSale is active but not yet started', () => {
    const product = {
      flashSale: {
        isActive: true,
        startTime: new Date(Date.now() + 3600000), // starts in 1h
        endTime: new Date(Date.now() + 7200000),
      },
      price: { currentPrice: 100000 },
    };
    expect(getOnSale(product)).toBe(false);
  });

  it('should return true when discountPrice < currentPrice (no flash sale)', () => {
    const product = {
      flashSale: null,
      price: { currentPrice: 100000, discountPrice: 80000 },
    };
    expect(getOnSale(product)).toBe(true);
  });

  it('should return false when discountPrice >= currentPrice', () => {
    const product = {
      flashSale: null,
      price: { currentPrice: 100000, discountPrice: 100000 },
    };
    expect(getOnSale(product)).toBe(false);
  });

  it('should return false when no discountPrice and no flashSale', () => {
    const product = {
      flashSale: null,
      price: { currentPrice: 100000, discountPrice: null },
    };
    expect(getOnSale(product)).toBe(false);
  });

  it('should return false when flashSale.isActive is false', () => {
    const product = {
      flashSale: {
        isActive: false,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
      },
      price: { currentPrice: 100000, discountPrice: null },
    };
    expect(getOnSale(product)).toBe(false);
  });
});

describe('Product Model – isActive virtual', () => {
  it('should return true for status "published"', () => {
    expect(getIsActive({ status: 'published' })).toBe(true);
  });

  it('should return false for status "draft"', () => {
    expect(getIsActive({ status: 'draft' })).toBe(false);
  });

  it('should return false for status "suspended"', () => {
    expect(getIsActive({ status: 'suspended' })).toBe(false);
  });

  it('should return false for status "deleted"', () => {
    expect(getIsActive({ status: 'deleted' })).toBe(false);
  });
});

describe('Product Model – effectivePrice virtual', () => {
  it('should return flashSale price when active and in time range', () => {
    const product = {
      flashSale: {
        isActive: true,
        salePrice: 50000,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
      },
      price: { currentPrice: 100000, discountPrice: 80000 },
    };
    expect(getEffectivePrice(product)).toBe(50000);
  });

  it('should return discountPrice when flashSale expired', () => {
    const product = {
      flashSale: {
        isActive: true,
        salePrice: 50000,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 3600000), // expired
      },
      price: { currentPrice: 100000, discountPrice: 80000 },
    };
    expect(getEffectivePrice(product)).toBe(80000);
  });

  it('should return discountPrice when no flashSale', () => {
    const product = {
      flashSale: null,
      price: { currentPrice: 100000, discountPrice: 75000 },
    };
    expect(getEffectivePrice(product)).toBe(75000);
  });

  it('should return currentPrice when no discountPrice and no flashSale', () => {
    const product = {
      flashSale: null,
      price: { currentPrice: 100000, discountPrice: null },
    };
    expect(getEffectivePrice(product)).toBe(100000);
  });

  it('should return currentPrice when flashSale.isActive is false', () => {
    const product = {
      flashSale: { isActive: false, salePrice: 50000 },
      price: { currentPrice: 100000 },
    };
    expect(getEffectivePrice(product)).toBe(100000);
  });
});

describe('Product Model – Variant Aggregation (pre-save hook)', () => {
  it('should sum stock across all variants', () => {
    const variants = [
      { stock: 10, sold: 5 },
      { stock: 20, sold: 3 },
      { stock: 5, sold: 2 },
    ];
    const { stock, soldCount } = aggregateVariants(variants);
    expect(stock).toBe(35);
    expect(soldCount).toBe(10);
  });

  it('should handle variants with zero stock', () => {
    const variants = [
      { stock: 0, sold: 0 },
      { stock: 0, sold: 0 },
    ];
    const { stock, soldCount } = aggregateVariants(variants);
    expect(stock).toBe(0);
    expect(soldCount).toBe(0);
  });

  it('should handle single variant', () => {
    const variants = [{ stock: 100, sold: 50 }];
    const { stock, soldCount } = aggregateVariants(variants);
    expect(stock).toBe(100);
    expect(soldCount).toBe(50);
  });

  it('should handle missing stock/sold values (default to 0)', () => {
    const variants = [{ stock: undefined, sold: undefined }, { stock: 10 }];
    const { stock, soldCount } = aggregateVariants(variants);
    expect(stock).toBe(10);
    expect(soldCount).toBe(0);
  });

  it('should handle empty variants array', () => {
    const { stock, soldCount } = aggregateVariants([]);
    expect(stock).toBe(0);
    expect(soldCount).toBe(0);
  });
});

describe('Product Model – Slug Generation (pre-validate hook)', () => {
  it('should generate slug from name via slugify rules', () => {
    // Re-implement: slugify(name, { lower: true, strict: true, locale: "vi" })
    const slugify = require('slugify');
    const slug = slugify('Áo Thun Nam Cotton', {
      lower: true,
      strict: true,
      locale: 'vi',
    });
    expect(slug).toBe('ao-thun-nam-cotton');
  });

  it('should handle special characters', () => {
    const slugify = require('slugify');
    const slug = slugify('Điện thoại iPhone 15 Pro Max', {
      lower: true,
      strict: true,
      locale: 'vi',
    });
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).toContain('dien-thoai');
  });

  it('should lowercase the slug', () => {
    const slugify = require('slugify');
    const slug = slugify('UPPERCASE NAME', {
      lower: true,
      strict: true,
    });
    expect(slug).toBe('uppercase-name');
  });
});
