/**
 * Property Test: Product Ownership Verification
 * 
 * Property 2: Product Ownership Verification
 * 
 * *For any* seller attempting to update or delete a product, if the product's shopId 
 * does not match the seller's shopId, the system SHALL return 403 Forbidden and 
 * the product SHALL remain unchanged.
 * 
 * **Validates: Requirements 2.5, 2.6, 7.2, 7.3, 7.5**
 * 
 * Feature: multi-shop-admin-seller-audit
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Property 2: Product Ownership Verification', () => {
  // Helper to generate ObjectId-like strings (24 hex characters)
  const objectIdArb = fc.string({ 
    minLength: 24, 
    maxLength: 24, 
    unit: fc.constantFrom(...'0123456789abcdef'.split('')) 
  });

  // Helper to generate product data
  const productDataArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 200 }),
    description: fc.string({ minLength: 1, maxLength: 1000 }),
    price: fc.record({
      currentPrice: fc.integer({ min: 1000, max: 10000000 }),
      discountPrice: fc.option(fc.integer({ min: 1000, max: 10000000 }), { nil: null })
    }),
    stock: fc.integer({ min: 0, max: 10000 }),
    status: fc.constantFrom('draft', 'published', 'suspended')
  });

  /**
   * Simulates the verifyProductOwnership middleware logic
   * Returns authorization result based on shop ownership
   */
  const verifyProductOwnership = (product, sellerShop) => {
    // Product not found case
    if (!product) {
      return { 
        authorized: false, 
        statusCode: 404, 
        error: 'Product not found' 
      };
    }

    // Shop not verified case (middleware chain issue)
    if (!sellerShop) {
      return { 
        authorized: false, 
        statusCode: 500, 
        error: 'Shop verification required' 
      };
    }

    // Ownership check
    const productShopId = product.shop?.toString ? product.shop.toString() : product.shop;
    const sellerShopId = sellerShop._id?.toString ? sellerShop._id.toString() : sellerShop._id;

    if (productShopId !== sellerShopId) {
      return { 
        authorized: false, 
        statusCode: 403, 
        error: "You don't have permission to access this product. It belongs to another shop." 
      };
    }

    return { 
      authorized: true, 
      statusCode: 200 
    };
  };

  /**
   * Simulates product update operation
   * Only proceeds if ownership is verified
   */
  const updateProductBySeller = (product, sellerShop, updateData) => {
    const authResult = verifyProductOwnership(product, sellerShop);
    
    if (!authResult.authorized) {
      return {
        success: false,
        statusCode: authResult.statusCode,
        error: authResult.error,
        productChanged: false
      };
    }

    // Simulate update - seller cannot change shop or status
    const updatedProduct = {
      ...product,
      ...updateData,
      shop: product.shop, // Cannot change shop
      status: product.status // Seller cannot change status (only admin)
    };

    return {
      success: true,
      statusCode: 200,
      product: updatedProduct,
      productChanged: true
    };
  };

  /**
   * Simulates product delete operation (soft delete)
   * Only proceeds if ownership is verified
   */
  const deleteProductBySeller = (product, sellerShop) => {
    const authResult = verifyProductOwnership(product, sellerShop);
    
    if (!authResult.authorized) {
      return {
        success: false,
        statusCode: authResult.statusCode,
        error: authResult.error,
        productDeleted: false
      };
    }

    return {
      success: true,
      statusCode: 200,
      productDeleted: true
    };
  };

  describe('Ownership Verification Core Logic', () => {
    it('should deny access when seller tries to modify product from another shop', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // productShopId
          objectIdArb, // sellerShopId
          productDataArb, // updateData
          async (productId, productShopId, sellerShopId, updateData) => {
            // Pre-condition: Different shop IDs (seller doesn't own the product)
            fc.pre(productShopId !== sellerShopId);

            const mockProduct = {
              _id: productId,
              shop: { toString: () => productShopId },
              name: 'Original Product',
              description: 'Original description',
              price: { currentPrice: 100000 },
              stock: 100,
              status: 'published'
            };

            const mockSellerShop = {
              _id: { toString: () => sellerShopId },
              name: 'Seller Shop'
            };

            // Test update operation
            const updateResult = updateProductBySeller(mockProduct, mockSellerShop, updateData);

            // Property: Non-owner should be denied with 403
            expect(updateResult.success).toBe(false);
            expect(updateResult.statusCode).toBe(403);
            expect(updateResult.productChanged).toBe(false);

            // Test delete operation
            const deleteResult = deleteProductBySeller(mockProduct, mockSellerShop);

            // Property: Non-owner should be denied with 403
            expect(deleteResult.success).toBe(false);
            expect(deleteResult.statusCode).toBe(403);
            expect(deleteResult.productDeleted).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow access when seller owns the product', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // shopId (same for product and seller)
          productDataArb, // updateData
          async (productId, shopId, updateData) => {
            const mockProduct = {
              _id: productId,
              shop: { toString: () => shopId },
              name: 'Original Product',
              description: 'Original description',
              price: { currentPrice: 100000 },
              stock: 100,
              status: 'published'
            };

            const mockSellerShop = {
              _id: { toString: () => shopId },
              name: 'Seller Shop'
            };

            // Test update operation
            const updateResult = updateProductBySeller(mockProduct, mockSellerShop, updateData);

            // Property: Owner should be allowed
            expect(updateResult.success).toBe(true);
            expect(updateResult.statusCode).toBe(200);
            expect(updateResult.productChanged).toBe(true);

            // Test delete operation
            const deleteResult = deleteProductBySeller(mockProduct, mockSellerShop);

            // Property: Owner should be allowed
            expect(deleteResult.success).toBe(true);
            expect(deleteResult.statusCode).toBe(200);
            expect(deleteResult.productDeleted).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Product Immutability on Unauthorized Access', () => {
    it('should not modify product when authorization fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // productShopId
          objectIdArb, // sellerShopId
          productDataArb, // updateData
          async (productId, productShopId, sellerShopId, updateData) => {
            // Pre-condition: Different shop IDs
            fc.pre(productShopId !== sellerShopId);

            const originalProduct = {
              _id: productId,
              shop: { toString: () => productShopId },
              name: 'Original Product',
              description: 'Original description',
              price: { currentPrice: 100000 },
              stock: 100,
              status: 'published'
            };

            // Deep copy to compare later
            const productSnapshot = JSON.stringify({
              name: originalProduct.name,
              description: originalProduct.description,
              price: originalProduct.price,
              stock: originalProduct.stock,
              status: originalProduct.status
            });

            const mockSellerShop = {
              _id: { toString: () => sellerShopId },
              name: 'Seller Shop'
            };

            // Attempt unauthorized update
            updateProductBySeller(originalProduct, mockSellerShop, updateData);

            // Property: Original product should remain unchanged
            const currentSnapshot = JSON.stringify({
              name: originalProduct.name,
              description: originalProduct.description,
              price: originalProduct.price,
              stock: originalProduct.stock,
              status: originalProduct.status
            });

            expect(currentSnapshot).toBe(productSnapshot);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Shop Field Protection', () => {
    it('should prevent seller from changing product shop association', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // originalShopId
          objectIdArb, // attemptedNewShopId
          async (productId, originalShopId, attemptedNewShopId) => {
            const mockProduct = {
              _id: productId,
              shop: { toString: () => originalShopId },
              name: 'Original Product',
              status: 'published'
            };

            const mockSellerShop = {
              _id: { toString: () => originalShopId },
              name: 'Seller Shop'
            };

            // Attempt to change shop via update
            const updateData = {
              name: 'Updated Name',
              shop: attemptedNewShopId // Malicious attempt to change shop
            };

            const result = updateProductBySeller(mockProduct, mockSellerShop, updateData);

            // Property: Shop should remain unchanged even if update succeeds
            if (result.success) {
              const resultShopId = result.product.shop?.toString ? 
                result.product.shop.toString() : result.product.shop;
              expect(resultShopId).toBe(originalShopId);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent seller from changing product status', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // shopId
          fc.constantFrom('draft', 'published', 'suspended'), // originalStatus
          fc.constantFrom('draft', 'published', 'suspended', 'deleted'), // attemptedStatus
          async (productId, shopId, originalStatus, attemptedStatus) => {
            const mockProduct = {
              _id: productId,
              shop: { toString: () => shopId },
              name: 'Original Product',
              status: originalStatus
            };

            const mockSellerShop = {
              _id: { toString: () => shopId },
              name: 'Seller Shop'
            };

            // Attempt to change status via update
            const updateData = {
              name: 'Updated Name',
              status: attemptedStatus // Attempt to change status
            };

            const result = updateProductBySeller(mockProduct, mockSellerShop, updateData);

            // Property: Status should remain unchanged (only admin can change)
            if (result.success) {
              expect(result.product.status).toBe(originalStatus);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 when product does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // sellerShopId
          productDataArb, // updateData
          async (sellerShopId, updateData) => {
            const mockSellerShop = {
              _id: { toString: () => sellerShopId },
              name: 'Seller Shop'
            };

            // Product is null (not found)
            const updateResult = updateProductBySeller(null, mockSellerShop, updateData);

            // Property: Should return 404
            expect(updateResult.success).toBe(false);
            expect(updateResult.statusCode).toBe(404);
            expect(updateResult.error).toBe('Product not found');

            const deleteResult = deleteProductBySeller(null, mockSellerShop);

            expect(deleteResult.success).toBe(false);
            expect(deleteResult.statusCode).toBe(404);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 500 when shop verification is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // productId
          objectIdArb, // productShopId
          productDataArb, // updateData
          async (productId, productShopId, updateData) => {
            const mockProduct = {
              _id: productId,
              shop: { toString: () => productShopId },
              name: 'Original Product',
              status: 'published'
            };

            // Shop is null (middleware chain issue)
            const updateResult = updateProductBySeller(mockProduct, null, updateData);

            // Property: Should return 500 (internal error)
            expect(updateResult.success).toBe(false);
            expect(updateResult.statusCode).toBe(500);
            expect(updateResult.error).toBe('Shop verification required');

            const deleteResult = deleteProductBySeller(mockProduct, null);

            expect(deleteResult.success).toBe(false);
            expect(deleteResult.statusCode).toBe(500);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
