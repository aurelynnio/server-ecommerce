const { Schema, model } = require('mongoose');

const newsletterSubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    source: {
      type: String,
      default: 'footer',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'newsletter_subscribers',
  },
);

newsletterSubscriberSchema.index({ email: 1 }, { unique: true });

module.exports = model('NewsletterSubscriber', newsletterSubscriberSchema);
