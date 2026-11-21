import { registerAs } from "@nestjs/config";

export default registerAs('storage', () => ({
  importBatchSize: parseInt(process.env.IMPORT_BATCH_SIZE, 10) || 1000,
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 100,
  uploadDirectory: process.env.UPLOAD_DIRECTORY || 'uploads',
}));