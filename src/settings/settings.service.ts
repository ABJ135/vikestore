import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Returns the singleton store-settings row.
   * If the row doesn't exist yet (fresh install before seeding), it is
   * auto-created with sensible defaults derived from environment variables.
   */
  async getSettings() {
    const settings = await this.prisma.storeSetting.findFirst();

    if (!settings) {
      return this.prisma.storeSetting.create({
        data: {
          storeName: process.env.STORE_NAME ?? 'My Store',
          supportEmail: process.env.STORE_ADMIN_EMAIL,
          currency: 'USD',
        },
      });
    }

    return settings;
  }

  /**
   * Partially updates the singleton store-settings row.
   */
  async updateSettings(dto: UpdateStoreSettingDto) {
    const settings = await this.prisma.storeSetting.findFirst();

    if (!settings) {
      throw new NotFoundException('Store settings not found. Run the seed script first.');
    }

    return this.prisma.storeSetting.update({
      where: { id: settings.id },
      data: dto,
    });
  }

  /**
   * Uploads a new store logo to Cloudinary, replaces the old one (if any),
   * and persists the resulting URL to the settings row.
   */
  async uploadLogo(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const settings = await this.getSettings();

    // Delete the previous logo from Cloudinary to avoid orphaned assets
    if (settings.logoUrl) {
      await this.cloudinary.deleteImage(settings.logoUrl).catch(() => {
        // Non-fatal: log and continue even if deletion fails
        console.warn('Could not delete old logo from Cloudinary:', settings.logoUrl);
      });
    }

    const result = await this.cloudinary.uploadImage(file, 'logo');

    return this.updateSettings({ logoUrl: result.secure_url });
  }
}
