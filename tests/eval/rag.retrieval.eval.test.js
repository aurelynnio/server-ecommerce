/**
 * Retrieval eval cho RAG: Recall@5 + MRR.
 *
 * Chạy: npm run test:eval
 *
 * Eval này gọi code thật `mergeHybridResults` (weighted RRF + minScore + rerank)
 * trên tập nhãn thủ công, không cần Mistral/Mongo nên chạy offline và deterministic.
 * Vector/BM25 scores trong dataset đại diện cho output của 2 nhánh retrieval.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { mergeHybridResults } = require('../../src/services/embedding.service');

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(readFileSync(resolve(__dirname, 'retrieval-dataset.json'), 'utf-8'));

const TOP_K = 5;
const MIN_SCORE = 0.25;
const MIN_TEXT_SCORE = 0.5;
const MIN_MEAN_RECALL = 0.9;
const MIN_MEAN_MRR = 0.8;

function rankProducts(testCase) {
  return mergeHybridResults(testCase.vectorResults, testCase.textResults, {
    limit: TOP_K,
    minScore: MIN_SCORE,
    minTextScore: MIN_TEXT_SCORE,
  }).map((item) => item.productId);
}

function recallAtK(rankedIds, relevantIds, k = TOP_K) {
  if (relevantIds.length === 0) return 0;
  const topK = new Set(rankedIds.slice(0, k));
  return relevantIds.filter((id) => topK.has(id)).length / relevantIds.length;
}

function reciprocalRank(rankedIds, relevantIds) {
  const index = rankedIds.findIndex((id) => relevantIds.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

describe('RAG retrieval eval - Recall@5 / MRR (real mergeHybridResults)', () => {
  it('dataset integrity: unique ids and labelled relevant products', () => {
    const ids = dataset.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const testCase of dataset) {
      expect(testCase.query).toBeTruthy();
      expect(testCase.relevantIds.length).toBeGreaterThan(0);
      expect(testCase.noiseIds?.length).toBeGreaterThan(0);

      const candidates = new Set([
        ...testCase.vectorResults.map((r) => r.productId),
        ...testCase.textResults.map((r) => r.productId),
      ]);
      // > TOP_K ứng viên để Recall@5 không đạt 1.0 một cách hiển nhiên.
      expect(candidates.size, `${testCase.id} cần > ${TOP_K} ứng viên`).toBeGreaterThan(TOP_K);
      for (const id of testCase.relevantIds) {
        expect(candidates.has(id), `${testCase.id} thiếu candidate ${id}`).toBe(true);
      }
    }
  });

  it('meets Recall@5 and MRR thresholds', () => {
    const rows = dataset.map((testCase) => {
      const ranked = rankProducts(testCase);
      return {
        id: testCase.id,
        ranked,
        recall: recallAtK(ranked, testCase.relevantIds),
        rr: reciprocalRank(ranked, testCase.relevantIds),
      };
    });

    const meanRecall = rows.reduce((sum, row) => sum + row.recall, 0) / rows.length;
    const meanMrr = rows.reduce((sum, row) => sum + row.rr, 0) / rows.length;

    // In metrics để CI log có số liệu thật, không chỉ pass/fail.
    for (const row of rows) {
      console.log(`[eval] ${row.id}: Recall@5=${row.recall.toFixed(2)} RR=${row.rr.toFixed(2)}`);
    }
    console.log(
      `[eval] mean Recall@5=${meanRecall.toFixed(3)} | mean MRR=${meanMrr.toFixed(3)} | cases=${rows.length}`,
    );

    expect(rows.every((row) => row.recall > 0)).toBe(true);
    expect(meanRecall).toBeGreaterThanOrEqual(MIN_MEAN_RECALL);
    expect(meanMrr).toBeGreaterThanOrEqual(MIN_MEAN_MRR);

    // Chống "tự thỏa mãn": phải có case không thể đạt Recall@5 = 1
    // (relevant nằm dưới minScore/minTextScore) và noise không được lọt top.
    expect(rows.some((row) => row.recall < 1)).toBe(true);
    for (const testCase of dataset) {
      const ranked = rankProducts(testCase);
      for (const noiseId of testCase.noiseIds || []) {
        expect(ranked, `${testCase.id} lọt noise ${noiseId}`).not.toContain(noiseId);
      }
    }
  });
});
