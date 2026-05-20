const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const newsletterRepository = require('../repositories/newsletter.repository');

class NewsletterService {
  async subscribe({ email, source = 'footer' }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email is required');
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid email address');
    }

    const existingSubscriber = await newsletterRepository.findByEmail(normalizedEmail);

    if (existingSubscriber) {
      if (!existingSubscriber.isActive) {
        existingSubscriber.isActive = true;
        existingSubscriber.source = source;
        await existingSubscriber.save();
      }

      return {
        email: existingSubscriber.email,
        alreadySubscribed: true,
      };
    }

    const subscriber = await newsletterRepository.create({
      email: normalizedEmail,
      source,
      isActive: true,
    });

    return {
      email: subscriber.email,
      alreadySubscribed: false,
    };
  }
}

module.exports = new NewsletterService();
