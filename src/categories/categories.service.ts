import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(dto: CreateCategoryDto) {
    const slug = this.slugify(dto.name);

    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id); // throws 404 if missing

    const data: Record<string, unknown> = { ...dto };

    if (dto.name) {
      data.slug = this.slugify(dto.name);
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // throws 404 if missing

    await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Category deleted' };
  }

  // Retrieve all soft-deleted categories
  async findAllInactive() {
    return this.prisma.category.findMany({
      where: { isActive: false },
      orderBy: { name: 'asc' },
    });
  }

  // Hard delete ALL soft-deleted categories
  async removeAllInactive() {
    const result = await this.prisma.category.deleteMany({
      where: { isActive: false },
    });

    return { message: `${result.count} categories permanently deleted` };
  }

  // Hard delete ONE soft-deleted category by id
  async removeInactiveById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category || !category.isActive === false ? false : !category) {
      // placeholder, fixed below
    }

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isActive) {
      throw new ConflictException('Category is still active; soft-delete it before hard-deleting');
    }

    await this.prisma.category.delete({ where: { id } });

    return { message: 'Category permanently deleted' };
  }

  async restore(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isActive) {
      throw new ConflictException('Category is already active');
    }

    return this.prisma.category.update({
      where: { id },
      data: { isActive: true },
    });
  }
}