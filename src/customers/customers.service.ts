import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany({
      where: { isActive: true },
      select: {
        ...customerSelect,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllInactive() {
    return this.prisma.customer.findMany({
      where: { isActive: false },
      select: {
        ...customerSelect,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        ...customerSelect,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: customerSelect,
    });

    if (!customer || !customer.isActive) {
      throw new NotFoundException('Customer profile not found');
    }

    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto) {
    await this.getProfile(customerId);

    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() }),
      },
      select: customerSelect,
    });
  }

  async create(dto: CreateCustomerDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existing = await this.prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.customer.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: dto.phone?.trim(),
      },
      select: customerSelect,
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id); // Ensure customer exists

    const updateData: Record<string, any> = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone?.trim();
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existing = await this.prisma.customer.findFirst({
        where: { email: normalizedEmail, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException('Email already in use by another customer');
      }
      updateData.email = normalizedEmail;
    }

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateData,
      select: customerSelect,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Customer deactivated successfully' };
  }

  async restore(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    if (customer.isActive) {
      throw new ConflictException('Customer is already active');
    }

    return this.prisma.customer.update({
      where: { id },
      data: { isActive: true },
      select: customerSelect,
    });
  }

  async getOrders(customerId: string) {
    await this.findOne(customerId);

    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        shippingPartner: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
