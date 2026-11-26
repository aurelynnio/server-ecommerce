/**
 * Unit tests cho embedding.service — import code thật (không copy stub).
 * Module an toàn khi import vì model Mistral được khởi tạo lazy.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  createProductTextContent,
  createProductSearchText,
  getVietnameseKeywords,
  computeContentHash,
  createProductMetadata,
  mergeHybridResults,
  fallbackTextSearch,
} = require('../../src/services/embedding.service');
const Product = require('../../src/repositories/product.repository');

describe('embedding.service (real module)', () => {
  describe('createProductTextContent()', () => {
    it('includes core product fields', () => {
      const result = createProductTextContent({
        name: 'Áo khoác nam',
        brand: 'Nike',
        category: { name: 'Thời trang' },
        tags: ['hot', 'new'],
        sizes: ['M', 'L'],
        variants: [{ color: 'Đen' }, { color: 'Trắng' }, { color: 'Đen' }],
        price: { currentPrice: 200000, discountPrice: 150000 },
      });

      expect(result).toContain('Tên sản phẩm: Áo khoác nam');
      expect(result).toContain('Thương hiệu: Nike');
      expect(result).toContain('Danh mục: Thời trang');
      expect(result).toContain('Tags: hot, new');
      expect(result).toContain('Kích cỡ: M, L');
      expect(result).toContain('Màu sắc: Đen, Trắng');
      expect(result.match(/Đen/g)).toHaveLength(1);
      expect(result).toContain('150');
    });

    it('includes attributes spec block', () => {
      const result = createProductTextContent({
        name: 'Áo thun',
        attributes: [
          { name: 'Chất liệu', value: 'Cotton' },
          { name: 'Xuất xứ', value: 'Việt Nam' },
          { name: '' },
          null,
        ],
      });

      expect(result).toContain('Thông số: Chất liệu: Cotton, Xuất xứ: Việt Nam');
    });

    it('includes flash-sale price when the campaign is active', () => {
      const now = Date.now();
      const result = createProductTextContent({
        name: 'Giày chạy bộ',
        price: { currentPrice: 500000, discountPrice: 450000 },
        flashSale: {
          isActive: true,
          salePrice: 299000,
          stock: 10,
          soldCount: 1,
          startTime: new Date(now - 60_000),
          endTime: new Date(now + 3600_000),
        },
      });

      expect(result).toContain('Giá flash sale');
      expect(result).toContain('299.000');
    });

    it('truncates description to 500 chars', () => {
      const result = createProductTextContent({
        name: 'Test',
        description: 'A'.repeat(600),
      });

      expect(result).toContain(`Mô tả: ${'A'.repeat(500)}`);
      expect(result).not.toContain('A'.repeat(501));
    });

    it('handles a minimal product', () => {
      expect(createProductTextContent({ name: 'Simple' })).toBe('Tên sản phẩm: Simple');
    });
  });

  describe('createProductSearchText()', () => {
    it('keeps real values and drops static labels used by the embedding text', () => {
      const searchText = createProductSearchText({
        name: 'Áo thun nam',
        brand: 'Nike',
        category: { name: 'Thời trang' },
        tags: ['cotton'],
        attributes: [{ name: 'Chất liệu', value: 'Cotton' }],
        description: 'Áo thun thoáng mát',
      });

      expect(searchText).toContain('Áo thun nam');
      expect(searchText).toContain('Nike');
      expect(searchText).toContain('Cotton');
      expect(searchText).not.toContain('Tên sản phẩm:');
      expect(searchText).not.toContain('Thương hiệu:');
      expect(searchText).not.toContain('Mô tả:');
    });
  });

  describe('mergeHybridResults() text score floor', () => {
    it('drops BM25 noise below minTextScore before RRF', () => {
      const merged = mergeHybridResults(
        [{ productId: 'p1', score: 0.9, metadata: { stock: 1 } }],
        [
          { productId: 'noise', score: 0.1, metadata: { stock: 5 } },
          { productId: 'p2', score: 3, metadata: { stock: 2 } },
        ],
        { minScore: 0.25, minTextScore: 0.5, limit: 5 },
      );

      const ids = merged.map((item) => item.productId);
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
      expect(ids).not.toContain('noise');
    });
  });

  describe('fallbackTextSearch() filter pass-through', () => {
    it('forwards brand/price/discount/stock filters to the repository', async () => {
      const spy = vi.spyOn(Product, 'findFallbackTextSearch').mockResolvedValue([]);

      await fallbackTextSearch('áo thun', {
        limit: 5,
        filter: {
          brand: 'Nike',
          minPrice: 0,
          maxPrice: 300000,
          hasDiscount: true,
          minStock: 2,
        },
      });

      expect(spy).toHaveBeenCalledWith(
        'áo thun',
        expect.objectContaining({
          brand: 'Nike',
          minPrice: 0,
          maxPrice: 300000,
          hasDiscount: true,
          minStock: 2,
        }),
      );
      spy.mockRestore();
    });
  });

  describe('getVietnameseKeywords()', () => {
    it.each([
      ['iPhone 15 Pro', 'điện thoại'],
      ['Áo thun cotton', 'áo thun'],
      ['Kem chống nắng SPF50', 'kem chống nắng'],
      ['Nồi chống dính 28cm', 'nồi chảo'],
      ['Laptop văn phòng 14 inch', 'laptop'],
      ['Bóng đá size 5', 'bóng đá'],
      ['Cà phê rang xay', 'cà phê'],
    ])('maps "%s" to industry keywords', (name, expected) => {
      expect(getVietnameseKeywords({ name })).toContain(expected);
    });

    it('does not match "top" inside "laptop"', () => {
      const keywords = getVietnameseKeywords({ name: 'Laptop gaming' });
      expect(keywords).not.toContain('áo thun');
      expect(keywords).toContain('laptop');
    });
  });

  describe('computeContentHash()', () => {
    it('is deterministic and sha256-sized', () => {
      const hash = computeContentHash('Tên sản phẩm: A');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(computeContentHash('Tên sản phẩm: A'));
      expect(hash).not.toBe(computeContentHash('Tên sản phẩm: B'));
    });
  });

  describe('createProductMetadata()', () => {
    const baseProduct = {
      _id: { toString: () => 'abc123' },
      name: 'Test Product',
      slug: 'test-product',
      brand: 'TestBrand',
      category: { name: 'Category', _id: { toString: () => 'cat456' } },
      price: { currentPrice: 200000, discountPrice: 150000 },
      status: 'published',
      isFeatured: true,
      stock: 50,
      soldCount: 100,
      ratingAverage: 4.5,
      variants: [{ images: ['img1.jpg'] }],
      shop: { status: 'active' },
    };

    it('maps core fields and discount price', () => {
      const meta = createProductMetadata(baseProduct);
      expect(meta.productId).toBe('abc123');
      expect(meta.categoryId).toBe('cat456');
      expect(meta.price).toBe(150000);
      expect(meta.originalPrice).toBe(200000);
      expect(meta.hasDiscount).toBe(true);
      expect(meta.productUrl).toBe('/products/test-product');
      expect(meta.checkoutUrl).toBe('/checkout?product=abc123');
      expect(meta.image).toBe('img1.jpg');
      expect(meta.shopStatus).toBe('active');
    });

    it('defaults nullable fields', () => {
      const meta = createProductMetadata({
        _id: { toString: () => 'min1' },
        name: 'Minimal',
        slug: 'minimal',
        price: { currentPrice: 0 },
        status: 'draft',
      });

      expect(meta.brand).toBeNull();
      expect(meta.category).toBeNull();
      expect(meta.categoryId).toBeNull();
      expect(meta.isFeatured).toBe(false);
      expect(meta.stock).toBe(0);
      expect(meta.image).toBeNull();
    });
  });
});
