import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';
import { UpdateImageDto } from './dto/update-image.dto';


@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly mailService: MailService,
  ) { }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const slug = this.slugify(dto.name);

    const existing = await this.prisma.product.findFirst({
      where: { OR: [{ sku: dto.sku }, { slug }] },
    });

    if (existing) {
      throw new ConflictException('SKU or product name already in use');
    }

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug,
        description: dto.description,
        priceCents: dto.priceCents,
        compareAtPriceCents: dto.compareAtPriceCents,
        stock: dto.stock,
        categoryId: dto.categoryId,
        images: dto.images
          ? {
            create: dto.images.map((img) => ({
              imageUrl: img.imageUrl,
              isPrimary: img.isPrimary ?? false,
              sortOrder: img.sortOrder ?? 0,
            })),
          }
          : undefined,
      },
      include: { images: true, category: true },
    });

    if (product.stock < 10) {
      this.mailService.sendLowStockAlert(product);
    }

    return product;
  }

  async findAll() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { images: true, category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true, category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const { images, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };

    if (dto.name) {
      const newSlug = this.slugify(dto.name);
      const collision = await this.prisma.product.findFirst({
        where: { slug: newSlug, NOT: { id } },
      });
      if (collision) {
        throw new ConflictException('Product name already in use');
      }
      data.slug = newSlug;
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data,
      include: { images: true, category: true },
    });

    if (updatedProduct.stock < 10) {
      this.mailService.sendLowStockAlert(updatedProduct);
    }

    return updatedProduct;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Product deleted' };
  }

  // Retrieve all soft-deleted products
  async findAllInactive() {
    return this.prisma.product.findMany({
      where: { isActive: false },
      include: { images: true, category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Hard delete ALL soft-deleted products
  async removeAllInactive() {
    const result = await this.prisma.product.deleteMany({
      where: { isActive: false },
    });

    return { message: `${result.count} products permanently deleted` };
  }

  // Hard delete ONE soft-deleted product by id
  async removeInactiveById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.isActive) {
      throw new ConflictException('Product is still active; soft-delete it before hard-deleting');
    }

    await this.prisma.product.delete({ where: { id } });

    return { message: 'Product permanently deleted' };
  }

  async addImage(productId: string, file: Express.Multer.File) {
    await this.findOne(productId); // 404 if product doesn't exist

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.cloudinary.uploadImage(file);

    return this.prisma.productImage.create({
      data: {
        productId,
        imageUrl: result.secure_url,
      },
    });
  }

  async removeImage(productId: string, imageId: string) {
    await this.findOne(productId); // 404 if product doesn't exist

    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== productId) {
      throw new NotFoundException('Image not found for this product');
    }

    await this.cloudinary.deleteImage(image.imageUrl);
    await this.prisma.productImage.delete({ where: { id: imageId } });

    return { message: 'Image deleted' };
  }

  async updateImage(productId: string, imageId: string, dto: UpdateImageDto) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== productId) {
      throw new NotFoundException('Image not found for this product');
    }

    return this.prisma.productImage.update({
      where: { id: imageId },
      data: dto,
    });
  }

  async restore(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.isActive) {
      throw new ConflictException('Product is already active');
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: true },
    });
  }
}