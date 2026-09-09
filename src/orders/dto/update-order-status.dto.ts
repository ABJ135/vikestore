import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @IsOptional()
  @IsUUID()
  shippingPartnerId?: string;

  @IsOptional()
  @IsString()
  trackingId?: string;
}

