import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** GET /settings — returns the current store configuration */
  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  /** PATCH /settings — partially update store configuration */
  @Patch()
  updateSettings(@Body() dto: UpdateStoreSettingDto) {
    return this.settingsService.updateSettings(dto);
  }
}
