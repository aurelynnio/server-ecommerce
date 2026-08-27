/**
 * OpenAPI 3.0 Paths: User Profiles & Addresses Management
 */

module.exports = {
  '/api/users/profile': {
    get: {
      tags: ['Users'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: {
          description: 'Current user profile data',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
        },
        401: { description: 'Unauthorized' },
      },
    },
    put: {
      tags: ['Users'],
      summary: 'Update current user profile info',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Nguyen Van A' },
                phoneNumber: { type: 'string', example: '0987654321' },
                bio: { type: 'string', example: 'Shopping enthusiast' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Profile updated successfully' },
        400: { description: 'Validation error' },
      },
    },
  },
  '/api/users/upload-avatar': {
    post: {
      tags: ['Users'],
      summary: 'Upload user profile avatar to Cloudinary',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['avatar'],
              properties: {
                avatar: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Avatar uploaded successfully' },
        400: { description: 'Invalid image format or size' },
      },
    },
  },
  '/api/users/addresses': {
    get: {
      tags: ['Users'],
      summary: 'Get all saved addresses for current user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: {
          description: 'List of addresses',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Address' } },
            },
          },
        },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Add a new delivery address',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Address' },
          },
        },
      },
      responses: {
        201: { description: 'Address created successfully' },
      },
    },
  },
  '/api/users/addresses/{addressId}': {
    put: {
      tags: ['Users'],
      summary: 'Update existing delivery address',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Address' },
          },
        },
      },
      responses: { 200: { description: 'Address updated' } },
    },
    delete: {
      tags: ['Users'],
      summary: 'Delete delivery address',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Address deleted' } },
    },
  },
  '/api/users/addresses/{addressId}/default': {
    put: {
      tags: ['Users'],
      summary: 'Set address as default shipping address',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'addressId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Default address updated' } },
    },
  },
  '/api/users': {
    get: {
      tags: ['Users'],
      summary: 'Get all users with pagination (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'role', in: 'query', schema: { type: 'string', enum: ['user', 'seller', 'admin'] } },
      ],
      responses: {
        200: { description: 'Paginated user list' },
        403: { description: 'Forbidden: Admin role required' },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Create user account directly (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RegisterRequest' },
          },
        },
      },
      responses: { 201: { description: 'User created' } },
    },
  },
  '/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get user details by ID (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'User data' }, 404: { description: 'User not found' } },
    },
    delete: {
      tags: ['Users'],
      summary: 'Delete user account (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'User deleted' } },
    },
  },
  '/api/users/{id}/role': {
    put: {
      tags: ['Users'],
      summary: 'Change user role (Admin only)',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['role'],
              properties: { role: { type: 'string', enum: ['user', 'seller', 'admin'] } },
            },
          },
        },
      },
      responses: { 200: { description: 'User role updated' } },
    },
  },
};
