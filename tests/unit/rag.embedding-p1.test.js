vi.mock('../../src/services/redis.service', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
}));

const {
  buildEmbeddingFilter,
  createProductMetadata,
  mergeHybridResults,
  getVectorSearchDefinition,
} = require('../../src/services/embedding.service');

describe('RAG embedding P1 contracts', () => {
  it('builds an Atlas pre-filter from supported product fields only', () => {
    expect(
      buildEmbeddingFilter({
        status: 'published',
        categoryId: 'cat-1',
        brand: 'Nike',
        minPrice: 100,
        maxPrice: 500,
        inStockOnly: true,
        hasDiscount: true,
        ignored: 'not-indexed',
      }),
    ).toEqual({
      'metadata.status': 'published',
      'metadata.categoryId': 'cat-1',
      'metadata.brand': 'Nike',
      'metadata.price': { $gte: 100, $lte: 500 },
      'metadata.stock': { $gt: 0 },
      'metadata.hasDiscount': true,
    });
  });

  it('uses active flash-sale price in filter metadata', () => {
    const now = new Date('2026-11-26T10:00:00.000Z');
    const metadata = createProductMetadata(
      {
        _id: 'product-1',
        name: 'Shoe',
        slug: 'shoe',
        status: 'published',
        stock: 3,
        price: { currentPrice: 500, discountPrice: 450 },
        flashSale: {
          isActive: true,
          salePrice: 300,
          startTime: new Date('2026-11-26T09:00:00.000Z'),
          endTime: new Date('2026-11-26T11:00:00.000Z'),
          stock: 10,
          soldCount: 1,
        },
        shop: { status: 'active' },
      },
      now,
    );

    expect(metadata.price).toBe(300);
    expect(metadata.hasDiscount).toBe(true);
    expect(metadata.shopStatus).toBe('active');
  });

  it('merges vector and BM25 ranks with RRF, threshold and deterministic reranking', () => {
    const vector = [
      { productId: 'p1', score: 0.9, metadata: { stock: 0, hasDiscount: false } },
      { productId: 'p2', score: 0.8, metadata: { stock: 5, hasDiscount: true } },
      { productId: 'low', score: 0.1, metadata: { stock: 5 } },
    ];
    const text = [
      { productId: 'p2', score: 4, metadata: { stock: 5, hasDiscount: true } },
      { productId: 'p3', score: 3, metadata: { stock: 2, hasDiscount: false } },
    ];

    const merged = mergeHybridResults(vector, text, { minScore: 0.2, limit: 3, rrfK: 60 });

    expect(merged.map((item) => item.productId)).toEqual(['p2', 'p1', 'p3']);
    expect(merged.some((item) => item.productId === 'low')).toBe(false);
    expect(merged[0].scores).toMatchObject({ vector: 0.8, text: 4 });
    expect(merged[0].score).toBeGreaterThan(merged[1].score);
  });

  it('declares an Atlas vectorSearch index with every supported filter field', () => {
    const definition = getVectorSearchDefinition();
    expect(definition.type).toBe('vectorSearch');
    expect(definition.definition.fields[0]).toEqual({
      type: 'vector',
      path: 'embedding',
      numDimensions: 1024,
      similarity: 'cosine',
    });
    expect(definition.definition.fields.slice(1).map((field) => field.path)).toEqual([
      'metadata.status',
      'metadata.categoryId',
      'metadata.brand',
      'metadata.price',
      'metadata.stock',
      'metadata.hasDiscount',
    ]);
  });
});

