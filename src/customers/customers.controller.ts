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
  Req,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // -------------------------------------------------------------
  // Customer Self-Service Endpoints (for logged-in customer)
  // -------------------------------------------------------------

  @Get('me')
  getProfile(@Req() req: any) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.getProfile(customerId);
  }

  @Patch('me')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.updateProfile(customerId, dto);
  }

  // -- Saved Addresses --

  @Get('me/addresses')
  getMyAddresses(@Req() req: any) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.getAddresses(customerId);
  }

  @Post('me/addresses')
  @HttpCode(HttpStatus.CREATED)
  addMyAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.addAddress(customerId, dto);
  }

  @Patch('me/addresses/:id')
  updateMyAddress(
    @Req() req: any,
    @Param('id') addressId: string,
    @Body() dto: CreateAddressDto,
  ) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.updateAddress(customerId, addressId, dto);
  }

  @Delete('me/addresses/:id')
  deleteMyAddress(@Req() req: any, @Param('id') addressId: string) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.deleteAddress(customerId, addressId);
  }

  @Patch('me/addresses/:id/set-default')
  setDefaultAddress(@Req() req: any, @Param('id') addressId: string) {
    const customerId = req.user.id || req.user.sub;
    return this.customersService.setDefaultAddress(customerId, addressId);
  }

  // -------------------------------------------------------------
  // Administrative Endpoints (Admin & Employee)
  // -------------------------------------------------------------

  @Roles('ADMIN', 'EMPLOYEE')
  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get('inactive')
  findAllInactive() {
    return this.customersService.findAllInactive();
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get(':id/orders')
  getOrders(@Param('id') id: string) {
    return this.customersService.getOrders(id);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Roles('ADMIN')
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.customersService.restore(id);
  }
}
