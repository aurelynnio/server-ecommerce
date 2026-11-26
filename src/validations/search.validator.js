const Joi = require('joi');

// Param lặp (?q=a&q=b) bị Express parse thành array → Joi.string()/number() từ chối.
const scalarString = (max) => Joi.string().trim().max(max).empty('');

const limitField = (defaultValue, max = 50) =>
  Joi.number().integer().min(1).max(max).default(defaultValue);

const searchQueryValidator = Joi.object({
  q: scalarString(200),
  category: scalarString(120),
  minPrice: Joi.number().min(0).empty(''),
  maxPrice: Joi.number().min(0).empty(''),
  rating: Joi.number().min(0).max(5).empty(''),
  sort: Joi.string()
    .valid('relevance', 'price_asc', 'price_desc', 'newest', 'bestselling', 'rating')
    .empty(''),
  page: Joi.number().integer().min(1).default(1),
  limit: limitField(20, 100),
});

const suggestionQueryValidator = Joi.object({
  q: scalarString(100),
  limit: limitField(10),
});

const trendingQueryValidator = Joi.object({
  limit: limitField(10),
});

const hotKeywordsQueryValidator = Joi.object({
  limit: limitField(20),
});

module.exports = {
  searchQueryValidator,
  suggestionQueryValidator,
  trendingQueryValidator,
  hotKeywordsQueryValidator,
};
