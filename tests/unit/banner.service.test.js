/**
 * Unit Tests: Banner Service Logic
 * Tests search query construction, delete null-check, filter merging
 */
import { describe, it, expect } from 'vitest';

describe('BannerService Logic', () => {
  // --- Search query construction ---
  describe('buildSearchQuery', () => {
    const buildSearchQuery = (filter = {}) => {
      const { search, ...otherFilters } = filter;
      let query = { ...otherFilters };

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { subtitle: { $regex: search, $options: 'i' } },
        ];
      }

      return query;
    };

    it('should return empty query when no filters', () => {
      expect(buildSearchQuery({})).toEqual({});
    });

    it('should build $or regex query for search term', () => {
      const result = buildSearchQuery({ search: 'promo' });
      expect(result.$or).toHaveLength(2);
      expect(result.$or[0]).toEqual({
        title: { $regex: 'promo', $options: 'i' },
      });
      expect(result.$or[1]).toEqual({
        subtitle: { $regex: 'promo', $options: 'i' },
      });
    });

    it('should preserve non-search filters', () => {
      const result = buildSearchQuery({ isActive: true });
      expect(result.isActive).toBe(true);
      expect(result.$or).toBeUndefined();
    });

    it('should merge search with other filters', () => {
      const result = buildSearchQuery({ search: 'sale', isActive: false });
      expect(result.isActive).toBe(false);
      expect(result.$or).toHaveLength(2);
      expect(result.$or[0].title.$regex).toBe('sale');
    });

    it('should not add $or when search is empty string', () => {
      const result = buildSearchQuery({ search: '' });
      expect(result.$or).toBeUndefined();
    });

    it('should not include search key in final query', () => {
      const result = buildSearchQuery({ search: 'test' });
      expect(result.search).toBeUndefined();
    });
  });

  // --- Delete result handling ---
  describe('deleteBannerResult', () => {
    const handleDeleteResult = (result) => {
      if (!result) return null;
      return { message: 'Banner deleted successfully' };
    };

    it('should return success message when result exists', () => {
      expect(handleDeleteResult({ _id: '123' })).toEqual({
        message: 'Banner deleted successfully',
      });
    });

    it('should return null when result is null', () => {
      expect(handleDeleteResult(null)).toBeNull();
    });

    it('should return null when result is undefined', () => {
      expect(handleDeleteResult(undefined)).toBeNull();
    });
  });

  // --- Image upload decision ---
  describe('shouldUploadImage', () => {
    const shouldUploadImage = (file) => {
      return !!file;
    };

    it('should return true when file is provided', () => {
      expect(shouldUploadImage({ buffer: Buffer.from('img') })).toBe(true);
    });

    it('should return false when file is null', () => {
      expect(shouldUploadImage(null)).toBe(false);
    });

    it('should return false when file is undefined', () => {
      expect(shouldUploadImage(undefined)).toBe(false);
    });
  });

  // --- Default params for getBanners ---
  describe('getBannersDefaults', () => {
    const parseGetBannersParams = ({ limit = 10, page = 1, filter = {} } = {}) => {
      return { limit, page, filter };
    };

    it('should use defaults when no params', () => {
      const result = parseGetBannersParams({});
      expect(result.limit).toBe(10);
      expect(result.page).toBe(1);
      expect(result.filter).toEqual({});
    });

    it('should override defaults with provided values', () => {
      const result = parseGetBannersParams({
        limit: 20,
        page: 3,
        filter: { isActive: true },
      });
      expect(result.limit).toBe(20);
      expect(result.page).toBe(3);
      expect(result.filter).toEqual({ isActive: true });
    });
  });
});
