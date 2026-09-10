import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly folder: string;

  constructor() {
    this.folder = process.env.CLOUDINARY_FOLDER ?? 'store';

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `${this.folder}/products` },
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
    // Matches /<folder>/products/<publicId>.<ext> at end of URL
    const escapedFolder = this.folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\/${escapedFolder}\\/products\\/([^./]+)\\.\\w+$`);
    const match = imageUrl.match(regex);
    return match ? `${this.folder}/products/${match[1]}` : null;
  }
}