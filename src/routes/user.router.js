const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  updateProfileValidator,
  addAddressValidator,
  updateAddressValidator,
  changePasswordValidator,
  createUserValidator,
  updateUserValidator,
  updateRoleValidator,
  updateUserByIdValidator,
  mongoIdParamValidator,
  addressIdParamValidator,
  paginationQueryValidator,
} = require("../validations/user.validator");
const upload = require("../configs/upload");

// Upload routes
router.post(
  "/upload-avatar",
  verifyAccessToken,
  upload.single("avatar"),
  userController.uploadAvatar
);

// Profile routes
router
  .route("/profile")
  .get(verifyAccessToken, userController.getProfile)
  .put(
    verifyAccessToken,
    validate(updateProfileValidator),
    userController.updateProfile
  );

// Address routes - ĐƯA LÊN TRƯỚC
router.post(
  "/address",
  verifyAccessToken,
  validate(addAddressValidator),
  userController.addAddress
);
router.put(
  "/address/:addressId",
  verifyAccessToken,
  validate({
    params: addressIdParamValidator,
    body: updateAddressValidator,
  }),
  userController.updateAddress
);
router.delete(
  "/address/:addressId",
  verifyAccessToken,
  validate({ params: addressIdParamValidator }),
  userController.deleteAddress
);
router.get("/address", verifyAccessToken, userController.getAddresses);

// Password management
router.put(
  "/change-password",
  verifyAccessToken,
  validate(changePasswordValidator),
  userController.changePassword
);

// User management routes (Admin only)
router.get(
  "/",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: paginationQueryValidator }),
  userController.getAllUsers
);

router.post(
  "/create",
  verifyAccessToken,
  requireRole("admin"),
  validate(createUserValidator),
  userController.createUser
);

// UPDATE USER - Sử dụng POST (như bạn muốn)
router.post(
  "/update",
  verifyAccessToken,
  requireRole("admin"),
  validate(updateUserValidator),
  userController.updateUser
);

// Role management
router.put(
  "/:id/role",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: mongoIdParamValidator,
    body: updateRoleValidator,
  }),
  userController.updateUserRole
);

router
  .route("/:id")
  .get(
    verifyAccessToken,
    requireRole("admin"),
    validate({ params: mongoIdParamValidator }),
    userController.getUserById
  )
  .put(
    verifyAccessToken,
    requireRole("admin"),
    validate({
      params: mongoIdParamValidator,
      body: updateUserByIdValidator,
    }),
    userController.updateUserById
  );

router.delete(
  "/:id",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: mongoIdParamValidator }),
  userController.deleteUser
);

module.exports = router;
