const cloudinary = require('cloudinary').v2;
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadAsset = async (
  fileBuffer,
  {
    folder = 'uploads',
    resourceType = 'auto',
    originalFilename,
    format,
  } = {},
) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        use_filename: true,
        folder: folder,
        unique_filename: true,
        overwrite: true,
        resource_type: resourceType,
        filename_override: originalFilename
          ? path.parse(originalFilename).name
          : undefined,
        format,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
    stream.end(fileBuffer);
  });
};

const uploadImage = async (fileBuffer, folder = 'avatar') =>
  uploadAsset(fileBuffer, { folder, resourceType: 'image' });

const multiUpload = async (fileBuffers, folder = 'avatar') => {
  if (!Array.isArray(fileBuffers)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Input must be an array of file buffers');
  }

  const uploadPromises = fileBuffers.map((buffer) => uploadImage(buffer, folder));
  const results = await Promise.all(uploadPromises);

  return results;
};

module.exports = { uploadAsset, uploadImage, multiUpload };
