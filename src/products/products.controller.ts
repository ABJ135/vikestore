import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UpdateImageDto } from './dto/update-image.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Public()
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get('inactive')
  findAllInactive() {
    return this.productsService.findAllInactive();
  }

  @Roles('ADMIN')
  @Delete('inactive/purge')
  removeAllInactive() {
    return this.productsService.removeAllInactive();
  }

  @Roles('ADMIN')
  @Delete('inactive/:id')
  removeInactiveById(@Param('id') id: string) {
    return this.productsService.removeInactiveById(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch('inactive/:id/restore')
  restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  uploadImage(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productsService.addImage(productId, file);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateImageDto,
  ) {
    return this.productsService.updateImage(productId, imageId, dto);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeImage(productId, imageId);
  }
}