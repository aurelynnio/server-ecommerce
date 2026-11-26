const { Schema, model } = require('mongoose');

const knowledgeDocumentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['shipping', 'return', 'warranty', 'freeship', 'faq'],
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'knowledge_documents' },
);

knowledgeDocumentSchema.index(
  { title: 'text', content: 'text' },
  { name: 'knowledge_text_search', weights: { title: 4, content: 1 } },
);

module.exports = model('KnowledgeDocument', knowledgeDocumentSchema);
