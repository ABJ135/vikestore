import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register({
      ttl: 3600 * 1000, // 1 hour in ms — safety-net TTL only; cache is actively invalidated on writes
      max: 10,
    }),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
