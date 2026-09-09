import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from '../generated/prisma/enums';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    let totalCents = 0;
    const orderItemsData = [];

    // Verify stock and calculate total before committing
    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.name}`);
      }

      const itemTotal = product.priceCents * item.quantity;
      totalCents += itemTotal;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        priceCents: product.priceCents,
      });

      // Deduct stock immediately (for robust e-commerce, this might be handled via a transaction or message queue)
      await this.prisma.product.update({
        where: { id: product.id },
        data: { stock: product.stock - item.quantity },
      });
    }

    return this.prisma.order.create({
      data: {
        customerId,
        totalCents,
        status: OrderStatus.PENDING,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  private enrichOrderWithTracking<T extends Record<string, any>>(order: T): T & { trackingUrl: string | null } {
    if (!order) return order as any;
    let trackingUrl: string | null = null;
    if (order.trackingId && order.shippingPartner?.trackingUrlTemplate) {
      trackingUrl = order.shippingPartner.trackingUrlTemplate
        .replace('{trackingId}', encodeURIComponent(order.trackingId))
        .replace('{{trackingId}}', encodeURIComponent(order.trackingId));
    }
    return {
      ...order,
      trackingUrl,
    };
  }

  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        shippingPartner: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.enrichOrderWithTracking(order));
  }

  async findByCustomer(customerId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId },
      include: {
        shippingPartner: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.enrichOrderWithTracking(order));
  }

  async findOne(id: string, user?: { id?: string; sub?: string; type?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        shippingPartner: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user && user.type !== 'ADMIN') {
      const requesterId = user.id || user.sub;
      if (order.customerId !== requesterId) {
        throw new NotFoundException('Order not found');
      }
    }

    return this.enrichOrderWithTracking(order);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(id); // Ensure order exists

    if (dto.shippingPartnerId) {
      const partner = await this.prisma.shippingPartner.findUnique({
        where: { id: dto.shippingPartnerId },
      });

      if (!partner) {
        throw new NotFoundException(`Shipping partner with ID ${dto.shippingPartnerId} not found`);
      }
    }

    const updateData: Record<string, any> = {
      status: dto.status,
    };

    if (dto.shippingPartnerId !== undefined) {
      updateData.shippingPartnerId = dto.shippingPartnerId;
    }

    if (dto.trackingId !== undefined) {
      updateData.trackingId = dto.trackingId;
    }

    if (dto.status === OrderStatus.SHIPPED) {
      updateData.shippedAt = new Date();
    } else if (dto.status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        shippingPartner: true,
        items: {
          include: { product: true },
        },
      },
    });

    return this.enrichOrderWithTracking(updatedOrder);
  }
}
