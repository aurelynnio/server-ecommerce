const Joi = require('joi');
const { objectId, pagination } = require('./common.validator');

const createNotificationValidator = Joi.object({
  type: Joi.string().valid('order_status', 'promotion', 'system', 'chat').default('system'),
  title: Joi.string().required(),
  message: Joi.string().required(),
  orderId: objectId,
  link: Joi.string(),
  recipient: objectId, // Optional if global
});

const updateNotificationValidator = Joi.object({
  title: Joi.string(),
  message: Joi.string(),
  type: Joi.string().valid('order_status', 'promotion', 'system', 'chat'),
  link: Joi.string().allow(''),
  isRead: Joi.boolean(),
});
const getListNotificationValidator = Joi.object({ ...pagination });

const notificationIdParamValidator = Joi.object({
  id: objectId.required(),
});

module.exports = {
  createNotificationValidator,
  updateNotificationValidator,
  getListNotificationValidator,
  notificationIdParamValidator,
};
