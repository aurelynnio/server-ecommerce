/**
 * OpenAPI 3.0 Paths: Authentication & Identity Management
 */

module.exports = {
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new customer or merchant account',
      description: 'Creates a new user account and sends a 6-digit OTP verification code to the registered email address.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RegisterRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Registration successful. Verification email sent.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        400: {
          description: 'Validation error or email already in use',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } },
        },
      },
    },
  },
  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Authenticate with email and password',
      description: 'Validates credentials. If 2FA is enabled, returns `twoFactorRequired: true` and a temporary token. Otherwise, sets httpOnly `accessToken` and `refreshToken` cookies.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LoginRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful. Tokens set in httpOnly cookies.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
        },
        401: { description: 'Invalid email or password' },
      },
    },
  },
  '/api/auth/2fa/verify-login': {
    post: {
      tags: ['Auth'],
      summary: 'Verify 2FA OTP during login',
      description: 'Completes 2-step verification using the 6-digit OTP sent to user email.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TwoFactorVerifyRequest' },
          },
        },
      },
      responses: {
        200: { description: '2FA verified. Access token set in cookies.' },
        400: { description: 'Invalid or expired OTP code' },
      },
    },
  },
  '/api/auth/2fa/resend-login-code': {
    post: {
      tags: ['Auth'],
      summary: 'Resend 2FA OTP during login',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['twoFactorToken'],
              properties: { twoFactorToken: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        200: { description: 'New 2FA OTP code sent' },
      },
    },
  },
  '/api/auth/verify-code': {
    post: {
      tags: ['Auth'],
      summary: 'Verify email registration code',
      description: 'Activates unverified account using 6-digit registration OTP.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/VerifyEmailRequest' },
          },
        },
      },
      responses: {
        200: { description: 'Email verified successfully. Account activated.' },
        400: { description: 'Invalid or expired code' },
      },
    },
  },
  '/api/auth/send-verification-code': {
    post: {
      tags: ['Auth'],
      summary: 'Resend email verification code',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email' } },
            },
          },
        },
      },
      responses: {
        200: { description: 'Verification code resent successfully' },
      },
    },
  },
  '/api/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request password reset OTP code',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ForgotPasswordRequest' },
          },
        },
      },
      responses: {
        200: { description: 'If the email exists, a password reset code was dispatched' },
      },
    },
  },
  '/api/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Reset account password with OTP',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ResetPasswordRequest' },
          },
        },
      },
      responses: {
        200: { description: 'Password reset successful. Please log in with new password.' },
        400: { description: 'Invalid OTP code' },
      },
    },
  },
  '/api/auth/refresh-token': {
    post: {
      tags: ['Auth'],
      summary: 'Refresh access token using refreshToken cookie',
      responses: {
        200: { description: 'Access token refreshed successfully' },
        401: { description: 'Invalid or expired refresh token' },
      },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout and clear authentication cookies',
      responses: {
        200: { description: 'Logged out successfully' },
      },
    },
  },
  '/api/auth/change-password': {
    post: {
      tags: ['Auth'],
      summary: 'Change password for authenticated user',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChangePasswordRequest' },
          },
        },
      },
      responses: {
        200: { description: 'Password changed successfully' },
        400: { description: 'Current password incorrect' },
        401: { description: 'Unauthorized' },
      },
    },
  },
  '/api/auth/2fa/send-code': {
    post: {
      tags: ['Auth'],
      summary: 'Send confirmation code to enable/disable 2FA',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: { description: '2FA confirmation code sent to email' },
      },
    },
  },
  '/api/auth/2fa/confirm': {
    post: {
      tags: ['Auth'],
      summary: 'Confirm enabling/disabling 2FA',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'enabled'],
              properties: {
                code: { type: 'string', example: '123456' },
                enabled: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
      responses: {
        200: { description: '2FA status updated' },
      },
    },
  },
};
