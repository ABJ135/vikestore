import { Module } from '@nestjs/common';
import { ShippingPartnersService } from './shipping-partners.service';
import { ShippingPartnersController } from './shipping-partners.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShippingPartnersController],
  providers: [ShippingPartnersService],
  exports: [ShippingPartnersService],
})
export class ShippingPartnersModule {}
