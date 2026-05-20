const catchAsync = require('../configs/catchAsync');
const { StatusCodes } = require('http-status-codes');
const { sendSuccess } = require('../shared/res/formatResponse');
const newsletterService = require('../services/newsletter.service');

const newsletterController = {
  subscribe: catchAsync(async (req, res) => {
    const result = await newsletterService.subscribe(req.body);

    return sendSuccess(
      res,
      result,
      result.alreadySubscribed
        ? 'Email is already subscribed'
        : 'Subscribed to newsletter successfully',
      StatusCodes.CREATED,
    );
  }),
};

module.exports = newsletterController;
