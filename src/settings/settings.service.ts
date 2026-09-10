import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
