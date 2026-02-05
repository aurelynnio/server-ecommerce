const multer = require("multer");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");

const storage = multer.memoryStorage();

const maxUploadMb = Number(process.env.UPLOAD_MAX_MB) || 5;
const maxFileSize = maxUploadMb * 1024 * 1024;
const maxFiles = Number(process.env.UPLOAD_MAX_FILES) || 5;
const allowedMime = (process.env.UPLOAD_ALLOWED_MIME || "image/")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const isAllowedMime = (mimetype) => {
  if (!mimetype) return false;
  return allowedMime.some((rule) =>
    rule.endsWith("/") ? mimetype.startsWith(rule) : mimetype === rule
  );
};

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: maxFiles },
  fileFilter: (req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      return cb(
        new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, "Unsupported file type")
      );
    }
    return cb(null, true);
  },
});

module.exports = upload;
