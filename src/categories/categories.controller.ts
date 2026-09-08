import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Public()
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Get('inactive')
  findAllInactive() {
    return this.categoriesService.findAllInactive();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  @Roles('ADMIN')
  @Delete('inactive/purge')
  removeAllInactive() {
    return this.categoriesService.removeAllInactive();
  }

  @Roles('ADMIN')
  @Delete('inactive/:id')
  removeInactiveById(@Param('id') id: string) {
    return this.categoriesService.removeInactiveById(id);
  }

  @Roles('ADMIN', 'EMPLOYEE')
  @Patch('inactive/:id/restore')
  restore(@Param('id') id: string) {
    return this.categoriesService.restore(id);
  }
}