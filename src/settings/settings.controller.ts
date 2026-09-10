import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { Public } from '../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /settings — returns the current store configuration */
  @Public()
  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  /** PATCH /settings — partially update store configuration (JSON fields only) */
  @Patch()
  updateSettings(@Body() dto: UpdateStoreSettingDto) {
    return this.settingsService.updateSettings(dto);
  }

  /**
   * POST /settings/logo — upload a new store logo via Cloudinary.
   * Expects multipart/form-data with a single field named "file".
   * Replaces the existing logo (if any) and returns the updated settings.
   */
  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.settingsService.uploadLogo(file);
  }
}
