const Joi = require("joi");

const notificationValidator = {
  createNotification: Joi.object({
    type: Joi.string().valid("order_status", "promotion", "system").default("system"),
    title: Joi.string().required(),
    message: Joi.string().required(),
    orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    link: Joi.string(),
  }),

  getListNotification: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  updateNotification: Joi.object({
    title: Joi.string(),
    message: Joi.string(),
    type: Joi.string().valid("order_status", "promotion", "system"),
    link: Joi.string().allow(""),
    isRead: Joi.boolean(),
  }),
};

module.exports = notificationValidator;
