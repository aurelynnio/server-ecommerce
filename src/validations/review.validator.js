const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");
const { escapedString } = require("./sanitize");

const createReviewValidator = Joi.object({
  productId: objectId.required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: escapedString().max(1000).allow(""),
});

const updateReviewValidator = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  comment: escapedString().max(1000).allow(""),
});

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  reviewIdParamValidator: Joi.object({ reviewId: objectId.required() }),
  productIdParamValidator: Joi.object({ productId: objectId.required() }),
  getReviewsQueryValidator: Joi.object({
    ...pagination,
    rating: Joi.number().integer().min(1).max(5),
    sort: Joi.string().valid("newest", "oldest", "highest", "lowest").default("newest"),
  }),
};
