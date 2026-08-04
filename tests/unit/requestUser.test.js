import { describe, expect, it } from 'vitest';

const { isRequestUserAdmin } = require('../../src/utils/requestUser');

describe('Request user role helpers', () => {
  it('recognizes the role shape populated by verifyAccessToken for payment admin access', () => {
    expect(isRequestUserAdmin({ role: ['admin'] })).toBe(true);
    expect(isRequestUserAdmin({ role: 'admin' })).toBe(true);
    expect(isRequestUserAdmin({ role: 'user' })).toBe(false);
  });
});
