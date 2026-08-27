/**
 * OpenAPI 3.0 Component Schemas
 * Standard request bodies, response models, and data types
 */

module.exports = {
  ApiResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'success' },
      code: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Operation completed successfully' },
      data: { type: 'object' },
    },
  },
  ApiErrorResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'fail' },
      code: { type: 'integer', example: 400 },
      message: { type: 'string', example: 'Invalid request parameters' },
      error: { type: 'string', example: 'ValidationError' },
    },
  },
  PaginationMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 100 },
      totalPages: { type: 'integer', example: 5 },
      hasNextPage: { type: 'boolean', example: true },
      hasPrevPage: { type: 'boolean', example: false },
    },
  },
  // Auth Models
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      password: { type: 'string', format: 'password', example: 'SecurePassword123!' },
    },
  },
  RegisterRequest: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', example: 'Nguyen Van A' },
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      password: { type: 'string', format: 'password', example: 'SecurePassword123!' },
      phoneNumber: { type: 'string', example: '0987654321' },
    },
  },
  VerifyEmailRequest: {
    type: 'object',
    required: ['email', 'code'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      code: { type: 'string', example: '123456' },
    },
  },
  ForgotPasswordRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
    },
  },
  ResetPasswordRequest: {
    type: 'object',
    required: ['email', 'code', 'newPassword'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      code: { type: 'string', example: '123456' },
      newPassword: { type: 'string', format: 'password', example: 'NewSecurePassword123!' },
    },
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', format: 'password', example: 'OldPassword123!' },
      newPassword: { type: 'string', format: 'password', example: 'NewPassword123!' },
    },
  },
  TwoFactorVerifyRequest: {
    type: 'object',
    required: ['twoFactorToken', 'code'],
    properties: {
      twoFactorToken: { type: 'string', example: 'eyJhbGciOiJIUzI1Ni...' },
      code: { type: 'string', example: '123456' },
    },
  },
  // User & Address Models
  UserProfile: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abcd' },
      name: { type: 'string', example: 'Nguyen Van A' },
      email: { type: 'string', example: 'user@example.com' },
      phoneNumber: { type: 'string', example: '0987654321' },
      role: { type: 'string', enum: ['user', 'seller', 'admin'], example: 'user' },
      avatar: { type: 'string', example: 'https://res.cloudinary.com/.../avatar.jpg' },
      isEmailVerified: { type: 'boolean', example: true },
      isTwoFactorEnabled: { type: 'boolean', example: false },
    },
  },
  Address: {
    type: 'object',
    required: ['fullName', 'phoneNumber', 'province', 'district', 'ward', 'street'],
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abcd' },
      fullName: { type: 'string', example: 'Nguyen Van A' },
      phoneNumber: { type: 'string', example: '0987654321' },
      province: { type: 'string', example: 'Ha Noi' },
      district: { type: 'string', example: 'Cau Giay' },
      ward: { type: 'string', example: 'Dich Vong' },
      street: { type: 'string', example: '123 Xuan Thuy' },
      isDefault: { type: 'boolean', example: true },
    },
  },
  // Product Models
  ProductVariant: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abe1' },
      tierIndex: { type: 'array', items: { type: 'integer' }, example: [0, 1] },
      price: { type: 'number', example: 250000 },
      stock: { type: 'integer', example: 100 },
      sku: { type: 'string', example: 'AT-NAM-DEN-L' },
      image: { type: 'string', example: 'https://res.cloudinary.com/.../image.jpg' },
    },
  },
  Product: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abcd' },
      name: { type: 'string', example: 'Ao Thun Nam Basic Cotton' },
      slug: { type: 'string', example: 'ao-thun-nam-basic-cotton' },
      description: { type: 'string', example: 'Chat lieu cotton 100% thoang mat' },
      price: { type: 'number', example: 250000 },
      originalPrice: { type: 'number', example: 300000 },
      stock: { type: 'integer', example: 200 },
      images: { type: 'array', items: { type: 'string' } },
      category: { type: 'string', example: '65df8a76b91234567890abc2' },
      shop: { type: 'string', example: '65df8a76b91234567890abc3' },
      rating: { type: 'number', example: 4.8 },
      soldCount: { type: 'integer', example: 150 },
      status: { type: 'string', enum: ['draft', 'published', 'suspended', 'deleted'], example: 'published' },
    },
  },
  // Cart & Order Models
  CartItem: {
    type: 'object',
    required: ['productId', 'quantity'],
    properties: {
      productId: { type: 'string', example: '65df8a76b91234567890abcd' },
      variantId: { type: 'string', example: '65df8a76b91234567890abe1' },
      quantity: { type: 'integer', minimum: 1, example: 2 },
    },
  },
  CreateOrderRequest: {
    type: 'object',
    required: ['items', 'shippingAddress', 'paymentMethod'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '65df8a76b91234567890abcd' },
            variantId: { type: 'string', example: '65df8a76b91234567890abe1' },
            quantity: { type: 'integer', example: 1 },
          },
        },
      },
      shippingAddress: { $ref: '#/components/schemas/Address' },
      paymentMethod: { type: 'string', enum: ['cod', 'vnpay'], example: 'vnpay' },
      voucherCode: { type: 'string', example: 'FREESHIP50K' },
      note: { type: 'string', example: 'Giao gio hanh chinh' },
    },
  },
  Order: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abcd' },
      orderCode: { type: 'string', example: 'ORD-987654' },
      user: { type: 'string', example: '65df8a76b91234567890abc1' },
      totalAmount: { type: 'number', example: 500000 },
      shippingFee: { type: 'number', example: 30000 },
      discountAmount: { type: 'number', example: 50000 },
      finalAmount: { type: 'number', example: 480000 },
      status: {
        type: 'string',
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        example: 'pending',
      },
      paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'], example: 'pending' },
      paymentMethod: { type: 'string', enum: ['cod', 'vnpay'], example: 'vnpay' },
    },
  },
  // Payment & Voucher Models
  CreatePaymentRequest: {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: { type: 'string', example: '65df8a76b91234567890abcd' },
      bankCode: { type: 'string', example: 'NCB' },
      language: { type: 'string', enum: ['vn', 'en'], example: 'vn' },
    },
  },
  Voucher: {
    type: 'object',
    properties: {
      _id: { type: 'string', example: '65df8a76b91234567890abcd' },
      code: { type: 'string', example: 'SALE20' },
      discountType: { type: 'string', enum: ['percentage', 'fixed'], example: 'percentage' },
      discountValue: { type: 'number', example: 20 },
      minOrderValue: { type: 'number', example: 200000 },
      maxDiscountAmount: { type: 'number', example: 50000 },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      isActive: { type: 'boolean', example: true },
    },
  },
  // Chatbot Models
  ChatMessageRequest: {
    type: 'object',
    required: ['message'],
    properties: {
      message: { type: 'string', example: 'Gợi ý cho tôi áo thun nam dưới 300k' },
      sessionId: { type: 'string', example: 'sess-e2b694b8-0f73-4ea2-8d76' },
    },
  },
  ChatFeedbackRequest: {
    type: 'object',
    required: ['sessionId', 'messageId', 'rating'],
    properties: {
      sessionId: { type: 'string', example: 'sess-e2b694b8-0f73-4ea2-8d76' },
      messageId: { type: 'string', example: 'msg-65df8a76b91234567890abcd' },
      rating: { type: 'string', enum: ['up', 'down'], example: 'up' },
      comment: { type: 'string', example: 'Gợi ý rất chuẩn size và giá' },
    },
  },
  // Health Models
  LivenessResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'live' },
      uptime: { type: 'number', example: 124.5 },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
  ReadinessResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'ready' },
      timestamp: { type: 'string', format: 'date-time' },
      services: {
        type: 'object',
        properties: {
          mongodb: { type: 'string', example: 'up' },
          redis: { type: 'string', example: 'up' },
          rabbitmq: { type: 'string', example: 'up' },
        },
      },
    },
  },
};
