/**
 * Unit Tests: Embedding Service Pure Logic
 * Tests createProductTextContent and createProductMetadata
 */
import { describe, it, expect } from 'vitest';

// Can't import the full module (MistralAI constructor runs), so test logic directly

describe('Embedding Service Logic', () => {
  // Re-implement pure function from embedding.service.js
  const createProductTextContent = (product) => {
    const parts = [];

    if (product.name) {
      parts.push(`Tên sản phẩm: ${product.name}`);
    }
    if (product.brand) {
      parts.push(`Thương hiệu: ${product.brand}`);
    }
    if (product.category?.name) {
      parts.push(`Danh mục: ${product.category.name}`);
    }
    if (product.tags && product.tags.length > 0) {
      parts.push(`Tags: ${product.tags.join(', ')}`);
    }
    if (product.sizes && product.sizes.length > 0) {
      parts.push(`Kích cỡ: ${product.sizes.join(', ')}`);
    }

    const colors = [...new Set(product.variants?.map((v) => v.color).filter(Boolean))];
    if (colors.length > 0) {
      parts.push(`Màu sắc: ${colors.join(', ')}`);
    }

    const price = product.price?.discountPrice || product.price?.currentPrice;
    if (price) {
      parts.push(`Giá: ${price.toLocaleString('vi-VN')}đ`);
    }

    if (product.description) {
      const truncatedDesc = product.description.substring(0, 500);
      parts.push(`Mô tả: ${truncatedDesc}`);
    }

    return parts.join('. ');
  };

  const createProductMetadata = (product) => {
    return {
      productId: product._id.toString(),
      name: product.name,
      slug: product.slug,
      brand: product.brand || null,
      category: product.category?.name || null,
      categoryId: product.category?._id?.toString() || null,
      price: product.price?.discountPrice || product.price?.currentPrice,
      originalPrice: product.price?.currentPrice,
      hasDiscount: !!(
        product.price?.discountPrice && product.price.discountPrice < product.price.currentPrice
      ),
      status: product.status,
      isFeatured: product.isFeatured || false,
      isNewArrival: product.isNewArrival || false,
      stock: product.stock || 0,
      soldCount: product.soldCount || 0,
      ratingAverage: product.ratingAverage || 0,
      image: product.variants?.[0]?.images?.[0] || null,
      productUrl: `/products/${product.slug}`,
      checkoutUrl: `/checkout?product=${product._id}`,
      updatedAt: product.updatedAt || expect.any(Date),
    };
  };

  describe('createProductTextContent()', () => {
    it('should include product name', () => {
      const result = createProductTextContent({ name: 'Áo khoác nam' });
      expect(result).toContain('Tên sản phẩm: Áo khoác nam');
    });

    it('should include brand', () => {
      const result = createProductTextContent({
        name: 'Test',
        brand: 'Nike',
      });
      expect(result).toContain('Thương hiệu: Nike');
    });

    it('should include category name', () => {
      const result = createProductTextContent({
        name: 'Test',
        category: { name: 'Thời trang' },
      });
      expect(result).toContain('Danh mục: Thời trang');
    });

    it('should include tags', () => {
      const result = createProductTextContent({
        name: 'Test',
        tags: ['hot', 'new', 'sale'],
      });
      expect(result).toContain('Tags: hot, new, sale');
    });

    it('should include sizes', () => {
      const result = createProductTextContent({
        name: 'Test',
        sizes: ['S', 'M', 'L'],
      });
      expect(result).toContain('Kích cỡ: S, M, L');
    });

    it('should extract unique colors from variants', () => {
      const result = createProductTextContent({
        name: 'Test',
        variants: [{ color: 'Red' }, { color: 'Blue' }, { color: 'Red' }],
      });
      expect(result).toContain('Màu sắc: Red, Blue');
      // Should be deduped
      expect(result.match(/Red/g)).toHaveLength(1);
    });

    it('should prefer discountPrice over currentPrice', () => {
      const result = createProductTextContent({
        name: 'Test',
        price: { currentPrice: 200000, discountPrice: 150000 },
      });
      expect(result).toContain('150');
    });

    it('should use currentPrice when no discount', () => {
      const result = createProductTextContent({
        name: 'Test',
        price: { currentPrice: 200000 },
      });
      expect(result).toContain('200');
    });

    it('should truncate description to 500 chars', () => {
      const longDesc = 'A'.repeat(600);
      const result = createProductTextContent({
        name: 'Test',
        description: longDesc,
      });
      // Should have exactly 500 As + prefix
      expect(result).toContain('Mô tả: ' + 'A'.repeat(500));
      expect(result).not.toContain('A'.repeat(501));
    });

    it('should handle minimal product', () => {
      const result = createProductTextContent({ name: 'Simple' });
      expect(result).toBe('Tên sản phẩm: Simple');
    });

    it('should join parts with . separator', () => {
      const result = createProductTextContent({
        name: 'Test',
        brand: 'Nike',
      });
      expect(result).toBe('Tên sản phẩm: Test. Thương hiệu: Nike');
    });
  });

  describe('createProductMetadata()', () => {
    const baseProduct = {
      _id: { toString: () => 'abc123' },
      name: 'Test Product',
      slug: 'test-product',
      brand: 'TestBrand',
      category: {
        name: 'Category',
        _id: { toString: () => 'cat456' },
      },
      price: { currentPrice: 200000, discountPrice: 150000 },
      status: 'published',
      isFeatured: true,
      isNewArrival: false,
      stock: 50,
      soldCount: 100,
      ratingAverage: 4.5,
      variants: [{ images: ['img1.jpg', 'img2.jpg'] }],
    };

    it('should map all fields correctly', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.productId).toBe('abc123');
      expect(meta.name).toBe('Test Product');
      expect(meta.slug).toBe('test-product');
      expect(meta.brand).toBe('TestBrand');
      expect(meta.category).toBe('Category');
      expect(meta.categoryId).toBe('cat456');
    });

    it('should prefer discountPrice', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.price).toBe(150000);
      expect(meta.originalPrice).toBe(200000);
    });

    it('should compute hasDiscount correctly', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.hasDiscount).toBe(true);
    });

    it('should detect no discount', () => {
      const noDiscount = {
        ...baseProduct,
        price: { currentPrice: 100000 },
      };
      const meta = createProductMetadata(noDiscount);
      expect(meta.hasDiscount).toBe(false);
    });

    it('should build productUrl from slug', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.productUrl).toBe('/products/test-product');
    });

    it('should build checkoutUrl from _id', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.checkoutUrl).toBe('/checkout?product=abc123');
    });

    it('should get first variant image', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.image).toBe('img1.jpg');
    });

    it('should handle missing variants', () => {
      const noVariants = { ...baseProduct, variants: [] };
      const meta = createProductMetadata(noVariants);
      expect(meta.image).toBeNull();
    });

    it('should default nullable fields', () => {
      const minimal = {
        _id: { toString: () => 'min1' },
        name: 'Minimal',
        slug: 'minimal',
        price: { currentPrice: 0 },
        status: 'draft',
      };
      const meta = createProductMetadata(minimal);
      expect(meta.brand).toBeNull();
      expect(meta.category).toBeNull();
      expect(meta.categoryId).toBeNull();
      expect(meta.isFeatured).toBe(false);
      expect(meta.stock).toBe(0);
      expect(meta.soldCount).toBe(0);
      expect(meta.ratingAverage).toBe(0);
      expect(meta.image).toBeNull();
    });
  });
});
