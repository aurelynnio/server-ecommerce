const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const maxUploadMb = Number(process.env.UPLOAD_MAX_MB) || 5;
const maxFileSize = maxUploadMb * 1024 * 1024;
const maxFiles = Number(process.env.UPLOAD_MAX_FILES) || 5;
const allowedMime = (process.env.UPLOAD_ALLOWED_MIME || 'image/')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const createUpload = ({
  customAllowedMime = allowedMime,
  customMaxFileSize = maxFileSize,
  customMaxFiles = maxFiles,
} = {}) =>
  multer({
    storage,
    limits: { fileSize: customMaxFileSize, files: customMaxFiles },
    fileFilter: (req, file, cb) => {
      if (!file?.mimetype) {
        return cb(new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Unsupported file type'));
      }

      const allowed = customAllowedMime.some((rule) =>
        rule.endsWith('/') ? file.mimetype.startsWith(rule) : file.mimetype === rule,
      );

      if (!allowed) {
        return cb(new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Unsupported file type'));
      }

      return cb(null, true);
    },
  });

const upload = createUpload();

module.exports = upload;
module.exports.createUpload = createUpload;
