const express = require('express');
const router = express.Router();
const HealthController = require('../controllers/health.controller');

router.get('/live', HealthController.live);
router.get('/ready', HealthController.ready);

module.exports = router;
