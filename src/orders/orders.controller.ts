import { Controller, Get, Post, Body, Patch, Param, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    const customerId = req.user.id || req.user.sub;
    return this.ordersService.create(customerId, createOrderDto);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('my-orders')
  findMyOrders(@Req() req: any) {
    const customerId = req.user.id || req.user.sub;
    return this.ordersService.findByCustomer(customerId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, req.user);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }
}
