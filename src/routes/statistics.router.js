const express = require("express");
const router = express.Router();
const statisticsController = require("../controllers/statistics.controller");
const { verifyAccessToken, requireRole } = require("../middlewares/auth.middleware");

// All routes require admin permission
router.use(verifyAccessToken, requireRole("admin"));

router.get("/dashboard", statisticsController.getDashboardStats);

module.exports = router;
