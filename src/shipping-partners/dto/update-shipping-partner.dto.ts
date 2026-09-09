import { PartialType } from '@nestjs/mapped-types';
import { CreateShippingPartnerDto } from './create-shipping-partner.dto';

export class UpdateShippingPartnerDto extends PartialType(CreateShippingPartnerDto) {}
