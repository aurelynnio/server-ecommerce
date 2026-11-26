import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  searchQueryValidator,
  suggestionQueryValidator,
  trendingQueryValidator,
} = require('../../src/validations/search.validator');

describe('search validators', () => {
  it('rejects repeated scalar params (?q=a&q=b → array)', () => {
    expect(searchQueryValidator.validate({ q: ['a', 'b'] }).error).toBeDefined();
    expect(searchQueryValidator.validate({ category: ['a', 'b'] }).error).toBeDefined();
    expect(searchQueryValidator.validate({ minPrice: ['0', '10'] }).error).toBeDefined();
    expect(suggestionQueryValidator.validate({ q: ['a', 'b'] }).error).toBeDefined();
  });

  it('caps limit and rejects unbounded/invalid values', () => {
    expect(searchQueryValidator.validate({ limit: 10000 }).error).toBeDefined();
    expect(searchQueryValidator.validate({ limit: 0 }).error).toBeDefined();
    expect(searchQueryValidator.validate({ limit: 100 }).error).toBeUndefined();
    expect(trendingQueryValidator.validate({ limit: 51 }).error).toBeDefined();
  });

  it('accepts minPrice=0 but rejects negative prices', () => {
    const valid = searchQueryValidator.validate({ minPrice: 0, maxPrice: 500000 });
    expect(valid.error).toBeUndefined();
    expect(valid.value.minPrice).toBe(0);
    expect(valid.value.maxPrice).toBe(500000);

    expect(searchQueryValidator.validate({ minPrice: -1 }).error).toBeDefined();
  });

  it('validates sort and page values', () => {
    expect(searchQueryValidator.validate({ sort: 'price_asc' }).error).toBeUndefined();
    expect(searchQueryValidator.validate({ sort: 'drop_table' }).error).toBeDefined();
    expect(searchQueryValidator.validate({ page: 0 }).error).toBeDefined();
  });
});
