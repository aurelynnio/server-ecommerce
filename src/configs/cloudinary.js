const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (fileBuffer, folder = "avatar") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        use_filename: true,
        folder: folder,
        unique_filename: true,
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

const multiUpload = async (fileBuffers, folder = "avatar") => {
  if (!Array.isArray(fileBuffers)) {
    throw new Error("Input must be an array of file buffers");
  }
  const uploadPromises = fileBuffers.map((buffer) => uploadImage(buffer, folder));
  const results = await Promise.all(uploadPromises);

  return results;
};

module.exports = { uploadImage, multiUpload };
