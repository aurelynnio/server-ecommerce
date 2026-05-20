const NewsletterSubscriber = require('../models/newsletter-subscriber.model');
const BaseRepository = require('./base.repository');

class NewsletterRepository extends BaseRepository {
  constructor() {
    super(NewsletterSubscriber);
  }

  findByEmail(email) {
    return this.findOneByFilter({ email });
  }
}

module.exports = new NewsletterRepository();
