import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ShippingPartnersService } from './shipping-partners.service';
import { CreateShippingPartnerDto } from './dto/create-shipping-partner.dto';
import { UpdateShippingPartnerDto } from './dto/update-shipping-partner.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('shipping-partners')
export class ShippingPartnersController {
  constructor(private readonly shippingPartnersService: ShippingPartnersService) {}

  @Public()
  @Get()
  findAll() {
    return this.shippingPartnersService.findAll();
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get('all')
  findAllAdmin() {
    return this.shippingPartnersService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shippingPartnersService.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateShippingPartnerDto) {
    return this.shippingPartnersService.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShippingPartnerDto) {
    return this.shippingPartnersService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shippingPartnersService.remove(id);
  }

  @Roles('ADMIN')
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.shippingPartnersService.restore(id);
  }
}
