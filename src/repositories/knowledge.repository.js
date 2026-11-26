const KnowledgeDocument = require('../models/knowledge-document.model');
const BaseRepository = require('./base.repository');

class KnowledgeRepository extends BaseRepository {
  constructor() {
    super(KnowledgeDocument);
  }

  upsertByKey(document) {
    return this.updateOne({ key: document.key }, { $set: document }, { upsert: true });
  }

  searchActive({ type, query, limit = 5 } = {}) {
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (query) filter.$text = { $search: String(query).slice(0, 300) };

    return this.findManyByFilter(filter)
      .select('key type title content source updatedAt')
      .sort(query ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new KnowledgeRepository();
