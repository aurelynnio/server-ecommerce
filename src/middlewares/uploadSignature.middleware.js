const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("./errorHandler.middleware");

const isJpeg = (buffer) =>
  buffer.length >= 3 &&
  buffer[0] === 0xff &&
  buffer[1] === 0xd8 &&
  buffer[2] === 0xff;

const isPng = (buffer) =>
  buffer.length >= 8 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

const isGif = (buffer) => {
  if (buffer.length < 6) return false;
  const header = buffer.subarray(0, 6).toString("ascii");
  return header === "GIF87a" || header === "GIF89a";
};

const isWebp = (buffer) => {
  if (buffer.length < 12) return false;
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  return riff === "RIFF" && webp === "WEBP";
};

const isSvg = (buffer) => {
  const snippet = buffer.subarray(0, 512).toString("utf8");
  return /<svg[\s>]/i.test(snippet);
};

const isValidImageSignature = (file) => {
  if (!file?.buffer) return false;

  if (isJpeg(file.buffer)) return true;
  if (isPng(file.buffer)) return true;
  if (isGif(file.buffer)) return true;
  if (isWebp(file.buffer)) return true;

  if (file.mimetype === "image/svg+xml" && isSvg(file.buffer)) return true;

  return false;
};

const validateImageSignature = (req, res, next) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((list) => {
      if (Array.isArray(list)) files.push(...list);
    });
  }

  if (files.length === 0) return next();

  const invalid = files.find((file) => !isValidImageSignature(file));
  if (invalid) {
    return next(
      new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, "Invalid image file"),
    );
  }

  return next();
};

module.exports = { validateImageSignature };
