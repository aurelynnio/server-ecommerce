/**
 * Unit Tests: Chatbot Tools Logic
 * Tests DTO transforms for search_products, get_product_details,
 * check_product_availability, compare_products, generate_checkout_link,
 * get_featured_products
 */
import { describe, it, expect } from 'vitest';

describe('ChatbotTools Logic', () => {
  // --- search_products DTO transform ---
  describe('searchProductsTransform', () => {
    const transformSearchResult = (products) => {
      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        hasDiscount: p.price?.discountPrice && p.price.discountPrice < p.price.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        image: p.variants?.[0]?.images?.[0] || null,
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    };

    it('should use discountPrice when available and less than current', () => {
      const products = [
        {
          _id: 'p1',
          name: 'Shirt',
          slug: 'shirt',
          price: { currentPrice: 200000, discountPrice: 150000 },
          brand: 'BrandX',
          category: { name: 'Clothing' },
          variants: [{ images: ['img.jpg'] }],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].price).toBe(150000);
      expect(result[0].originalPrice).toBe(200000);
      expect(result[0].hasDiscount).toBe(true);
    });

    it('should use currentPrice when no discount', () => {
      const products = [
        {
          _id: 'p1',
          name: 'Shirt',
          slug: 'shirt',
          price: { currentPrice: 200000 },
          variants: [],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].price).toBe(200000);
      expect(result[0].hasDiscount).toBeFalsy();
    });

    it('should not flag discount when discountPrice >= currentPrice', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100000, discountPrice: 100000 },
          variants: [],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].hasDiscount).toBe(false);
    });

    it('should extract first variant image', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100 },
          variants: [{ images: ['v1.jpg', 'v2.jpg'] }],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].image).toBe('v1.jpg');
    });

    it('should return null image when no variants', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100 },
          variants: [],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].image).toBeNull();
    });

    it('should count variants', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100 },
          variants: [{ size: 'S' }, { size: 'M' }, { size: 'L' }],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].variantCount).toBe(3);
    });

    it('should handle missing variants', () => {
      const products = [{ _id: 'p1', name: 'A', slug: 'a', price: { currentPrice: 100 } }];
      const result = transformSearchResult(products);
      expect(result[0].variantCount).toBe(0);
    });

    it('should build URLs correctly', () => {
      const products = [
        {
          _id: 'abc123',
          name: 'A',
          slug: 'test-product',
          price: { currentPrice: 100 },
          variants: [],
        },
      ];
      const result = transformSearchResult(products);
      expect(result[0].checkoutUrl).toBe('/checkout?product=abc123');
      expect(result[0].productUrl).toBe('/products/test-product');
    });
  });

  // --- check_product_availability: filter by size/color ---
  describe('checkAvailability', () => {
    const checkAvailability = (variants, { size, color } = {}) => {
      let filtered = variants || [];

      if (size) filtered = filtered.filter((v) => v.size?.toLowerCase() === size.toLowerCase());
      if (color) filtered = filtered.filter((v) => v.color?.toLowerCase() === color.toLowerCase());

      const available = filtered.filter((v) => v.stock > 0);
      const totalStock = available.reduce((sum, v) => sum + v.stock, 0);

      return {
        available: available.length > 0,
        totalStock,
        variants: available,
        message: available.length > 0 ? `Còn ${totalStock} sản phẩm` : 'Hết hàng',
      };
    };

    it('should return all in-stock variants when no filter', () => {
      const variants = [
        { size: 'S', color: 'Red', stock: 5 },
        { size: 'M', color: 'Blue', stock: 0 },
        { size: 'L', color: 'Red', stock: 3 },
      ];
      const result = checkAvailability(variants);
      expect(result.available).toBe(true);
      expect(result.totalStock).toBe(8);
      expect(result.variants).toHaveLength(2);
    });

    it('should filter by size', () => {
      const variants = [
        { size: 'S', color: 'Red', stock: 5 },
        { size: 'M', color: 'Blue', stock: 3 },
      ];
      const result = checkAvailability(variants, { size: 'S' });
      expect(result.totalStock).toBe(5);
      expect(result.variants).toHaveLength(1);
    });

    it('should filter by color', () => {
      const variants = [
        { size: 'S', color: 'Red', stock: 5 },
        { size: 'M', color: 'Blue', stock: 3 },
      ];
      const result = checkAvailability(variants, { color: 'blue' });
      expect(result.totalStock).toBe(3);
    });

    it('should filter by both size and color', () => {
      const variants = [
        { size: 'S', color: 'Red', stock: 5 },
        { size: 'S', color: 'Blue', stock: 2 },
        { size: 'M', color: 'Red', stock: 3 },
      ];
      const result = checkAvailability(variants, {
        size: 'S',
        color: 'red',
      });
      expect(result.totalStock).toBe(5);
      expect(result.variants).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const variants = [{ size: 'XL', color: 'Navy Blue', stock: 10 }];
      const result = checkAvailability(variants, {
        size: 'xl',
        color: 'NAVY BLUE',
      });
      expect(result.available).toBe(true);
      expect(result.totalStock).toBe(10);
    });

    it('should return out of stock message', () => {
      const variants = [{ size: 'S', color: 'Red', stock: 0 }];
      const result = checkAvailability(variants);
      expect(result.available).toBe(false);
      expect(result.message).toBe('Hết hàng');
    });

    it('should handle empty variants', () => {
      const result = checkAvailability([]);
      expect(result.available).toBe(false);
      expect(result.totalStock).toBe(0);
    });

    it('should handle null variants', () => {
      const result = checkAvailability(null);
      expect(result.available).toBe(false);
    });
  });

  // --- compare_products: extract unique sizes/colors ---
  describe('compareProductsTransform', () => {
    const transformForComparison = (products) => {
      return products.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price?.discountPrice || p.price?.currentPrice,
        originalPrice: p.price?.currentPrice,
        brand: p.brand,
        category: p.category?.name,
        variantCount: p.variants?.length || 0,
        sizes: [...new Set(p.variants?.map((v) => v.size).filter(Boolean))],
        colors: [...new Set(p.variants?.map((v) => v.color).filter(Boolean))],
        checkoutUrl: `/checkout?product=${p._id}`,
        productUrl: `/products/${p.slug}`,
      }));
    };

    it('should extract unique sizes', () => {
      const products = [
        {
          _id: 'p1',
          name: 'Shirt',
          slug: 'shirt',
          price: { currentPrice: 100 },
          variants: [
            { size: 'S', color: 'Red' },
            { size: 'M', color: 'Red' },
            { size: 'S', color: 'Blue' },
          ],
        },
      ];
      const result = transformForComparison(products);
      expect(result[0].sizes).toEqual(['S', 'M']);
    });

    it('should extract unique colors', () => {
      const products = [
        {
          _id: 'p1',
          name: 'Shirt',
          slug: 'shirt',
          price: { currentPrice: 100 },
          variants: [
            { size: 'S', color: 'Red' },
            { size: 'M', color: 'Red' },
            { size: 'S', color: 'Blue' },
          ],
        },
      ];
      const result = transformForComparison(products);
      expect(result[0].colors).toEqual(['Red', 'Blue']);
    });

    it('should filter out null/undefined sizes and colors', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100 },
          variants: [{ size: 'S' }, { color: 'Red' }, { size: null, color: null }],
        },
      ];
      const result = transformForComparison(products);
      expect(result[0].sizes).toEqual(['S']);
      expect(result[0].colors).toEqual(['Red']);
    });

    it('should handle empty variants', () => {
      const products = [{ _id: 'p1', name: 'A', slug: 'a', price: { currentPrice: 100 } }];
      const result = transformForComparison(products);
      expect(result[0].sizes).toEqual([]);
      expect(result[0].colors).toEqual([]);
      expect(result[0].variantCount).toBe(0);
    });

    it('should transform multiple products', () => {
      const products = [
        {
          _id: 'p1',
          name: 'A',
          slug: 'a',
          price: { currentPrice: 100 },
          variants: [],
        },
        {
          _id: 'p2',
          name: 'B',
          slug: 'b',
          price: { currentPrice: 200 },
          variants: [{ size: 'M' }],
        },
      ];
      const result = transformForComparison(products);
      expect(result).toHaveLength(2);
      expect(result[1].sizes).toEqual(['M']);
    });
  });

  // --- generate_checkout_link: URL building ---
  describe('generateCheckoutLink', () => {
    const buildCheckoutUrl = (productId, variantId, quantity = 1) => {
      let url = `/checkout?product=${productId}&quantity=${quantity}`;
      if (variantId) url += `&variant=${variantId}`;
      return url;
    };

    const buildAddToCartUrl = (productId, variantId, quantity = 1) => {
      let url = `/cart/add?product=${productId}`;
      if (variantId) url += `&variant=${variantId}`;
      url += `&quantity=${quantity}`;
      return url;
    };

    it('should build checkout URL without variant', () => {
      expect(buildCheckoutUrl('p1', null, 1)).toBe('/checkout?product=p1&quantity=1');
    });

    it('should build checkout URL with variant', () => {
      expect(buildCheckoutUrl('p1', 'v1', 2)).toBe('/checkout?product=p1&quantity=2&variant=v1');
    });

    it('should default quantity to 1', () => {
      expect(buildCheckoutUrl('p1', null)).toBe('/checkout?product=p1&quantity=1');
    });

    it('should build add-to-cart URL without variant', () => {
      expect(buildAddToCartUrl('p1', null, 1)).toBe('/cart/add?product=p1&quantity=1');
    });

    it('should build add-to-cart URL with variant', () => {
      expect(buildAddToCartUrl('p1', 'v1', 3)).toBe('/cart/add?product=p1&variant=v1&quantity=3');
    });
  });

  // --- get_featured_products: query type routing ---
  describe('featuredProductQuery', () => {
    const buildFeaturedQuery = (type) => {
      const query = { status: 'published' };
      let sort = { soldCount: -1 };

      if (type === 'featured') {
        query.isFeatured = true;
      } else if (type === 'newArrivals') {
        query.isNewArrival = true;
        sort = { createdAt: -1 };
      } else if (type === 'onSale') {
        query['price.discountPrice'] = { $exists: true, $ne: null };
        query.$expr = {
          $lt: ['$price.discountPrice', '$price.currentPrice'],
        };
      }

      return { query, sort };
    };

    it('should build featured query', () => {
      const { query, sort } = buildFeaturedQuery('featured');
      expect(query.isFeatured).toBe(true);
      expect(sort).toEqual({ soldCount: -1 });
    });

    it('should build newArrivals query with createdAt sort', () => {
      const { query, sort } = buildFeaturedQuery('newArrivals');
      expect(query.isNewArrival).toBe(true);
      expect(sort).toEqual({ createdAt: -1 });
    });

    it('should build onSale query with price conditions', () => {
      const { query } = buildFeaturedQuery('onSale');
      expect(query['price.discountPrice']).toEqual({
        $exists: true,
        $ne: null,
      });
      expect(query.$expr).toBeDefined();
    });

    it('should default to published status only', () => {
      const { query } = buildFeaturedQuery('unknown');
      expect(query.status).toBe('published');
      expect(query.isFeatured).toBeUndefined();
      expect(query.isNewArrival).toBeUndefined();
    });
  });

  // --- get_product_details: variant DTO ---
  describe('productDetailVariantTransform', () => {
    const transformVariants = (variants) => {
      return (variants || []).map((v) => ({
        id: v._id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        price: v.price?.discountPrice || v.price?.currentPrice,
        image: v.images?.[0],
      }));
    };

    it('should transform variant with discount price', () => {
      const variants = [
        {
          _id: 'v1',
          size: 'M',
          color: 'Red',
          stock: 10,
          price: { currentPrice: 200000, discountPrice: 150000 },
          images: ['img.jpg'],
        },
      ];
      const result = transformVariants(variants);
      expect(result[0].price).toBe(150000);
      expect(result[0].image).toBe('img.jpg');
    });

    it('should use currentPrice when no discount', () => {
      const variants = [
        {
          _id: 'v1',
          size: 'L',
          color: 'Blue',
          stock: 5,
          price: { currentPrice: 100000 },
          images: [],
        },
      ];
      const result = transformVariants(variants);
      expect(result[0].price).toBe(100000);
    });

    it('should handle null variants', () => {
      expect(transformVariants(null)).toEqual([]);
    });

    it('should handle empty variants', () => {
      expect(transformVariants([])).toEqual([]);
    });

    it('should handle variant without images', () => {
      const variants = [{ _id: 'v1', size: 'S', color: 'X', stock: 1, price: {} }];
      const result = transformVariants(variants);
      expect(result[0].image).toBeUndefined();
    });
  });

  // --- Price query builder for search_products ---
  describe('priceQueryBuilder', () => {
    const buildPriceQuery = (minPrice, maxPrice) => {
      if (!minPrice && !maxPrice) return null;
      const q = {};
      if (minPrice) q.$gte = minPrice;
      if (maxPrice) q.$lte = maxPrice;
      return q;
    };

    it('should build min only', () => {
      expect(buildPriceQuery(100, null)).toEqual({ $gte: 100 });
    });

    it('should build max only', () => {
      expect(buildPriceQuery(null, 500)).toEqual({ $lte: 500 });
    });

    it('should build range', () => {
      expect(buildPriceQuery(100, 500)).toEqual({ $gte: 100, $lte: 500 });
    });

    it('should return null for no filter', () => {
      expect(buildPriceQuery(null, null)).toBeNull();
    });
  });
});
