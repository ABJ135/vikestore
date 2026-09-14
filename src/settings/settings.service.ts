import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';

// Derive the shape from Prisma's inferred return type — version-agnostic
type StoreSettingRow = NonNullable<Awaited<ReturnType<PrismaService['storeSetting']['findFirst']>>>;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly CACHE_KEY = 'store-settings';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Returns the singleton store-settings row.
   * Checks the in-process cache first; on miss, queries Prisma and primes the cache.
   * If the row doesn't exist yet (fresh install before seeding), it is
   * auto-created with sensible defaults derived from environment variables.
   */
  async getSettings() {
    const cached = await this.cache.get<StoreSettingRow>(this.CACHE_KEY);
    if (cached) return cached;

    let settings = await this.prisma.storeSetting.findFirst();

    if (!settings) {
      settings = await this.prisma.storeSetting.create({
        data: {
          storeName: process.env.STORE_NAME ?? 'My Store',
          supportEmail: process.env.STORE_ADMIN_EMAIL,
          currency: 'USD',
        },
      });
    }

    await this.cache.set(this.CACHE_KEY, settings);
    return settings;
  }

  /**
   * Partially updates the singleton store-settings row.
   * Invalidates the NestJS cache and triggers Next.js tag revalidation so the
   * customer frontend reflects the change immediately without a full redeploy.
   */
  async updateSettings(dto: UpdateStoreSettingDto) {
    const settings = await this.prisma.storeSetting.findFirst();

    if (!settings) {
      throw new NotFoundException('Store settings not found. Run the seed script first.');
    }

    const updated = await this.prisma.storeSetting.update({
      where: { id: settings.id },
      data: dto,
    });

    // Invalidate the in-process cache immediately after a successful write
    await this.cache.del(this.CACHE_KEY);

    // Notify the Next.js frontend to revalidate its cached fetch for store-settings
    await this.notifyFrontend('store-settings');

    return updated;
  }

  /**
   * Uploads a new store logo to Cloudinary, replaces the old one (if any),
   * and persists the resulting URL to the settings row.
   * Cache invalidation is handled by the updateSettings() call below.
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
        this.logger.warn('Could not delete old logo from Cloudinary:', settings.logoUrl);
      });
    }

    const result = await this.cloudinary.uploadImage(file, 'logo');

    return this.updateSettings({ logoUrl: result.secure_url });
  }

  /**
   * Fires a POST request to the Next.js revalidation endpoint with a shared secret.
   * Failures are logged but never thrown — a network blip must not roll back a
   * successful settings update. The 1-hour TTL is the fallback safety net.
   */
  private async notifyFrontend(tag: string): Promise<void> {
    const url = process.env.NEXT_PUBLIC_URL;
    const secret = process.env.REVALIDATE_SECRET;

    if (!url || !secret) {
      this.logger.warn(
        'NEXT_PUBLIC_URL or REVALIDATE_SECRET not set — skipping frontend revalidation',
      );
      return;
    }

    try {
      const res = await fetch(`${url}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tag }),
      });

      if (!res.ok) {
        this.logger.warn(
          `Frontend revalidation returned non-OK status: ${res.status} for tag "${tag}"`,
        );
      } else {
        this.logger.log(`Frontend revalidation triggered for tag "${tag}"`);
      }
    } catch (err) {
      // Non-fatal: log the error and let the TTL handle eventual consistency
      this.logger.error(`Failed to notify frontend for revalidation (tag: "${tag}")`, err);
    }
  }
}
