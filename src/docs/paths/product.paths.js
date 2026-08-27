/**
 * OpenAPI 3.0 Paths: Products & Variants Catalog Management
 */

module.exports = {
  '/api/products': {
    get: {
      tags: ['Products'],
      summary: 'Get paginated products with filtering & sorting',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'shop', in: 'query', schema: { type: 'string' } },
        { name: 'minPrice', in: 'query', schema: { type: 'number' } },
        { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['price_asc', 'price_desc', 'newest', 'sold_desc', 'rating_desc'],
          },
        },
      ],
      responses: {
        200: {
          description: 'Paginated product list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                  pagination: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['Products'],
      summary: 'Create new product (Seller / Admin)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['name', 'price', 'category'],
              properties: {
                name: { type: 'string', example: 'Ao Thun Nam Basic Cotton' },
                price: { type: 'number', example: 250000 },
                category: { type: 'string', example: '65df8a76b91234567890abc2' },
                description: { type: 'string' },
                images: { type: 'array', items: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
      },
      responses: { 201: { description: 'Product created successfully' } },
    },
  },
  '/api/products/search': {
    get: {
      tags: ['Products'],
      summary: 'Search products with text autocomplete',
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      ],
      responses: { 200: { description: 'Matching product results' } },
    },
  },
  '/api/products/featured': {
    get: {
      tags: ['Products'],
      summary: 'Get featured top-rated products',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 8 } }],
      responses: { 200: { description: 'Featured products list' } },
    },
  },
  '/api/products/new-arrivals': {
    get: {
      tags: ['Products'],
      summary: 'Get newly added products',
      responses: { 200: { description: 'New arrivals' } },
    },
  },
  '/api/products/on-sale': {
    get: {
      tags: ['Products'],
      summary: 'Get products currently discounted',
      responses: { 200: { description: 'Discounted products list' } },
    },
  },
  '/api/products/slug/{slug}': {
    get: {
      tags: ['Products'],
      summary: 'Get single product details by URL slug',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Product details',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } },
        },
        404: { description: 'Product not found' },
      },
    },
  },
  '/api/products/category/{slug}': {
    get: {
      tags: ['Products'],
      summary: 'Get products by category slug',
      parameters: [
        { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { 200: { description: 'Products under category' } },
    },
  },
  '/api/products/related/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Get related products in same category',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Related products list' } },
    },
  },
  '/api/products/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Get product by MongoDB ObjectId',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: {
          description: 'Product details',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } },
        },
      },
    },
  },
  '/api/products/seller/{id}': {
    put: {
      tags: ['Products'],
      summary: 'Update product by seller (Owner only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product updated successfully' } },
    },
    delete: {
      tags: ['Products'],
      summary: 'Soft-delete product by seller',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product moved to trash' } },
    },
  },
  '/api/products/seller/{id}/variants': {
    post: {
      tags: ['Products'],
      summary: 'Add variant to product',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 201: { description: 'Variant added' } },
    },
  },
  '/api/products/seller/{id}/variants/{variantId}': {
    put: {
      tags: ['Products'],
      summary: 'Update variant details',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Variant updated' } },
    },
    delete: {
      tags: ['Products'],
      summary: 'Delete variant from product',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'variantId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Variant deleted' } },
    },
  },
  '/api/products/{id}/permanent': {
    delete: {
      tags: ['Products'],
      summary: 'Permanently remove product from database (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Product permanently purged' } },
    },
  },
};

