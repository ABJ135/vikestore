import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShippingPartnerDto } from './dto/create-shipping-partner.dto';
import { UpdateShippingPartnerDto } from './dto/update-shipping-partner.dto';

@Injectable()
export class ShippingPartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShippingPartnerDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.shippingPartner.findFirst({
      where: {
        OR: [{ name: dto.name.trim() }, { code: normalizedCode }],
      },
    });

    if (existing) {
      throw new ConflictException('Shipping partner with this name or code already exists');
    }

    return this.prisma.shippingPartner.create({
      data: {
        ...dto,
        name: dto.name.trim(),
        code: normalizedCode,
      },
    });
  }

  async findAll() {
    return this.prisma.shippingPartner.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.shippingPartner.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const partner = await this.prisma.shippingPartner.findUnique({
      where: { id },
    });

    if (!partner) {
      throw new NotFoundException(`Shipping partner with ID ${id} not found`);
    }

    return partner;
  }

  async update(id: string, dto: UpdateShippingPartnerDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = { ...dto };

    if (dto.name) {
      data.name = dto.name.trim();
    }

    if (dto.code) {
      const normalizedCode = dto.code.trim().toUpperCase();
      data.code = normalizedCode;

      const existing = await this.prisma.shippingPartner.findFirst({
        where: {
          code: normalizedCode,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`Shipping partner with code ${normalizedCode} already exists`);
      }
    }

    return this.prisma.shippingPartner.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.shippingPartner.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Shipping partner deactivated successfully' };
  }

  async restore(id: string) {
    const partner = await this.findOne(id);

    if (partner.isActive) {
      throw new ConflictException('Shipping partner is already active');
    }

    return this.prisma.shippingPartner.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Helper to resolve tracking URL from template and tracking ID
   */
  resolveTrackingUrl(template?: string | null, trackingId?: string | null): string | null {
    if (!template || !trackingId) {
      return null;
    }
    return template
      .replace('{trackingId}', encodeURIComponent(trackingId))
      .replace('{{trackingId}}', encodeURIComponent(trackingId));
  }
}
