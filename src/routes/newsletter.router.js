const express = require('express');

const router = express.Router();
const newsletterController = require('../controllers/newsletter.controller');
const { newsletterRateLimiter } = require('../middlewares/rateLimit.middleware');

router.post('/subscribe', newsletterRateLimiter, newsletterController.subscribe);

module.exports = router;
