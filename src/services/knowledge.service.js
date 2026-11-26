const KnowledgeRepository = require('../repositories/knowledge.repository');

const ALLOWED_TYPES = new Set(['shipping', 'return', 'warranty', 'freeship', 'faq']);

function validateSourceDocument(document) {
  if (!document || typeof document !== 'object') throw new Error('Knowledge document is required');
  if (!document.key || !document.title || !document.source) {
    throw new Error('Knowledge document requires key, title and source');
  }
  if (!ALLOWED_TYPES.has(document.type)) throw new Error(`Unsupported knowledge type: ${document.type}`);
  const content = String(document.content || '').trim();
  if (!content || /\bPENDING\b/i.test(content)) {
    throw new Error(`Knowledge document ${document.key} has no approved content`);
  }
  return { ...document, content };
}

async function upsertSourceDocuments(documents) {
  if (!Array.isArray(documents)) throw new Error('Knowledge source must be an array');
  const validated = documents.map(validateSourceDocument);
  for (const document of validated) {
    await KnowledgeRepository.upsertByKey({
      ...document,
      isActive: document.isActive !== false,
    });
  }
  return { indexed: validated.length };
}

async function searchKnowledge(query, { type, limit = 5 } = {}) {
  return KnowledgeRepository.searchActive({
    type: type && ALLOWED_TYPES.has(type) ? type : undefined,
    query,
    limit: Math.min(10, Math.max(1, Number(limit) || 5)),
  });
}

module.exports = { searchKnowledge, upsertSourceDocuments, validateSourceDocument };
