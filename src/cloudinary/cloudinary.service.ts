import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly rootFolder: string;

  constructor() {
    this.rootFolder = process.env.CLOUDINARY_FOLDER ?? 'store';

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload a file to Cloudinary.
   * @param file   - The Multer file buffer to upload.
   * @param folder - Sub-folder under the root folder (defaults to 'products').
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `${this.rootFolder}/${folder}` },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed, no result returned'));
          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(imageUrl: string): Promise<void> {
    const publicId = this.extractPublicId(imageUrl);
    if (!publicId) return;

    await cloudinary.uploader.destroy(publicId);
  }

  /**
   * Extracts the Cloudinary public ID from a secure URL.
   * Works for any sub-folder under the root folder (e.g. /products/, /logo/).
   */
  private extractPublicId(imageUrl: string): string | null {
    // Match /<rootFolder>/<subfolder>/<publicId>.<ext> at the end of the URL
    const escapedRoot = this.rootFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\/(${escapedRoot}\\/[^/]+\\/[^./]+)\\.\\w+$`,
    );
    const match = imageUrl.match(regex);
    return match ? match[1] : null;
  }
}