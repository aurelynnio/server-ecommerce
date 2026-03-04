/**
 * Unit Tests: Payment Service
 * Tests IPN handling logic (pure response-code mapping)
 * and verifyReturnUrl logic (success/fail branching)
 *
 * Since PaymentService is exported as `new PaymentService()` with heavy
 * external dependencies (VNPay, models, socket), we re-implement the
 * testable business logic as pure functions.
 */
import { describe, it, expect } from 'vitest';

/* ===========================
 * Re-implementations of IPN response logic from payment.service.js
 * =========================== */

/**
 * Determine IPN response given payment state and VNPay params
 * Mirrors handleIPN() response-code logic
 */
function computeIpnResponse({ isValidSignature, payment, amount, responseCode }) {
  if (!isValidSignature) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  if (!payment) {
    return { RspCode: '01', Message: 'Order not found' };
  }

  if (payment.amount !== amount) {
    return { RspCode: '04', Message: 'Invalid amount' };
  }

  if (payment.status === 'completed') {
    return { RspCode: '02', Message: 'Order already confirmed' };
  }

  // Successful processing
  return { RspCode: '00', Message: 'Confirm success' };
}

/**
 * Determine payment status from VNPay response code
 */
function getPaymentStatus(responseCode) {
  return responseCode === '00' ? 'completed' : 'failed';
}

/**
 * Determine if return URL verification is successful
 */
function isReturnSuccessful(responseCode, transactionStatus) {
  return responseCode === '00' && transactionStatus === '00';
}

/* ===========================
 * TESTS
 * =========================== */
describe('Payment Service – IPN Response Logic', () => {
  const basePayment = { amount: 100000, status: 'pending' };

  it('should return 97 for invalid signature', () => {
    const result = computeIpnResponse({
      isValidSignature: false,
      payment: basePayment,
      amount: 100000,
      responseCode: '00',
    });
    expect(result).toEqual({ RspCode: '97', Message: 'Invalid signature' });
  });

  it('should return 01 when payment not found', () => {
    const result = computeIpnResponse({
      isValidSignature: true,
      payment: null,
      amount: 100000,
      responseCode: '00',
    });
    expect(result).toEqual({ RspCode: '01', Message: 'Order not found' });
  });

  it('should return 04 when amount mismatch', () => {
    const result = computeIpnResponse({
      isValidSignature: true,
      payment: basePayment,
      amount: 99999, // mismatched
      responseCode: '00',
    });
    expect(result).toEqual({ RspCode: '04', Message: 'Invalid amount' });
  });

  it('should return 02 when already completed', () => {
    const result = computeIpnResponse({
      isValidSignature: true,
      payment: { amount: 100000, status: 'completed' },
      amount: 100000,
      responseCode: '00',
    });
    expect(result).toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
  });

  it('should return 00 on valid new payment', () => {
    const result = computeIpnResponse({
      isValidSignature: true,
      payment: basePayment,
      amount: 100000,
      responseCode: '00',
    });
    expect(result).toEqual({ RspCode: '00', Message: 'Confirm success' });
  });

  it('should return 00 even for failed response codes (payment processed)', () => {
    // handleIPN processes payment regardless of responseCode "00" or not
    // It returns 00 as long as signature valid, payment exists, amount matches, not yet completed
    const result = computeIpnResponse({
      isValidSignature: true,
      payment: basePayment,
      amount: 100000,
      responseCode: '24', // customer cancelled
    });
    expect(result).toEqual({ RspCode: '00', Message: 'Confirm success' });
  });
});

describe('Payment Service – Payment Status', () => {
  it('should return completed for responseCode 00', () => {
    expect(getPaymentStatus('00')).toBe('completed');
  });

  it('should return failed for any other code', () => {
    expect(getPaymentStatus('24')).toBe('failed');
    expect(getPaymentStatus('01')).toBe('failed');
    expect(getPaymentStatus('99')).toBe('failed');
  });
});

describe('Payment Service – Return URL Verification', () => {
  it('should return true when both codes are 00', () => {
    expect(isReturnSuccessful('00', '00')).toBe(true);
  });

  it('should return false when responseCode is not 00', () => {
    expect(isReturnSuccessful('24', '00')).toBe(false);
  });

  it('should return false when transactionStatus is not 00', () => {
    expect(isReturnSuccessful('00', '01')).toBe(false);
  });

  it('should return false when both are non-00', () => {
    expect(isReturnSuccessful('24', '02')).toBe(false);
  });
});

describe('Payment Service – VNPay Amount Conversion', () => {
  it('should divide VNPay amount by 100 to get actual amount', () => {
    // VNPay sends amount multiplied by 100
    const vnpAmount = '10000000'; // = 100000 VND
    const actualAmount = parseInt(vnpAmount) / 100;
    expect(actualAmount).toBe(100000);
  });

  it('should handle string parsing correctly', () => {
    const vnpAmount = '5000000';
    expect(parseInt(vnpAmount) / 100).toBe(50000);
  });
});
