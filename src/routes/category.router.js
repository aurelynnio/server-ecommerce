const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createCategoryValidator,
  updateCategoryValidator,
  categoryIdParamValidator,
  categorySlugParamValidator,
  getCategoriesQueryValidator,
} = require("../validations/category.validator");

// Public routes (no authentication required)
router.get(
  "/active",
  validate({ query: getCategoriesQueryValidator }),
  categoryController.getActiveCategories
);
router.get("/tree", categoryController.getCategoryTree);
router.get(
  "/slug/:slug",
  validate({ params: categorySlugParamValidator }),
  categoryController.getCategoryBySlug
);

// Admin routes (require admin role)
router.post(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate(createCategoryValidator),
  categoryController.createCategory
);
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: getCategoriesQueryValidator }),
  categoryController.getAllCategories
);
router.get(
  "/statistics",
  verifyAccessToken,
  requireRole("admin"),
  categoryController.getCategoryStatistics
);
router.get(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.getCategoryById
);
router.get(
  "/:categoryId/subcategories",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.getCategoryWithSubcategories
);
router.put(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: categoryIdParamValidator,
    body: updateCategoryValidator,
  }),
  categoryController.updateCategory
);
router.delete(
  "/:categoryId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: categoryIdParamValidator }),
  categoryController.deleteCategory
);

module.exports = router;

