import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'vikestore/products' },
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

  private extractPublicId(imageUrl: string): string | null {
    const match = imageUrl.match(/\/vikestore\/products\/([^./]+)\.\w+$/);
    return match ? `vikestore/products/${match[1]}` : null;
  }
}