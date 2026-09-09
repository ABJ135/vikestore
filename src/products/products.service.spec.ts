import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;
  let cloudinary: { uploadImage: jest.Mock; deleteImage: jest.Mock };
  let mailService: { sendLowStockAlert: jest.Mock; sendNewOrderAlert: jest.Mock };

  beforeEach(async () => {
    prisma = {
      category: { findUnique: jest.fn() },
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      productImage: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    cloudinary = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
    };

    mailService = {
      sendLowStockAlert: jest.fn(),
      sendNewOrderAlert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('throws NotFoundException if category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          sku: 'SKU-1',
          name: 'Test Product',
          priceCents: 1000,
          stock: 5,
          categoryId: 'missing-cat',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if sku or slug already exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.product.findFirst.mockResolvedValue({ id: 'existing-product' });

      await expect(
        service.create({
          sku: 'SKU-1',
          name: 'Test Product',
          priceCents: 1000,
          stock: 5,
          categoryId: 'cat-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a product with a generated slug', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU-1',
        name: 'Wireless Mouse',
        slug: 'wireless-mouse',
      });

      const result = await service.create({
        sku: 'SKU-1',
        name: 'Wireless Mouse',
        priceCents: 2999,
        stock: 10,
        categoryId: 'cat-1',
      });

      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.slug).toBe('wireless-mouse');
      expect(result.slug).toBe('wireless-mouse');
    });
  });

  describe('findOne', () => {
    it('returns the product if found', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Test' });

      const result = await service.findOne('prod-1');

      expect(result.id).toBe('prod-1');
    });

    it('throws NotFoundException if not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (soft delete)', () => {
    it('sets isActive to false instead of deleting the row', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true });
      prisma.product.update.mockResolvedValue({ id: 'prod-1', isActive: false });

      const result = await service.remove('prod-1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
      expect(prisma.product.delete).not.toHaveBeenCalled();
      expect(result.message).toBe('Product deleted');
    });
  });

  describe('removeInactiveById (hard delete)', () => {
    it('throws ConflictException if product is still active', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: true });

      await expect(service.removeInactiveById('prod-1')).rejects.toThrow(ConflictException);
    });

    it('permanently deletes if product is already inactive', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', isActive: false });
      prisma.product.delete.mockResolvedValue({ id: 'prod-1' });

      const result = await service.removeInactiveById('prod-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
      expect(result.message).toBe('Product permanently deleted');
    });
  });

  describe('removeImage', () => {
    it('throws NotFoundException if image belongs to a different product', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.productImage.findUnique.mockResolvedValue({
        id: 'img-1',
        productId: 'some-other-product',
      });

      await expect(service.removeImage('prod-1', 'img-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes from cloudinary and the database when valid', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.productImage.findUnique.mockResolvedValue({
        id: 'img-1',
        productId: 'prod-1',
        imageUrl: 'https://res.cloudinary.com/x/vikestore/products/img-1.jpg',
      });
      prisma.productImage.delete.mockResolvedValue({});

      const result = await service.removeImage('prod-1', 'img-1');

      expect(cloudinary.deleteImage).toHaveBeenCalled();
      expect(prisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
      expect(result.message).toBe('Image deleted');
    });
  });
});