import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesDto,
  MoveCategoryDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({ summary: 'Create a new category' })
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.create(dto, user.id);
    return { message: 'Category created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL CATEGORIES (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all categories with optional filters' })
  async findAll(@Query() dto: ListCategoriesDto) {
    const result = await this.categoryService.findAll(dto);
    return {
      message: 'Categories retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY TREE (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('tree')
  @Public()
  @ApiOperation({ summary: 'Get full category tree hierarchy' })
  async getTree() {
    const data = await this.categoryService.getTree();
    return { message: 'Category tree retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY SLUG (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiOperation({ summary: 'Get category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.categoryService.findBySlug(slug);
    return { message: 'Category retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.categoryService.findOne(id);
    return { message: 'Category retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({ summary: 'Update category' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.update(id, dto, user.id);
    return { message: 'Category updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // MOVE CATEGORY
  // ══════════════════════════════════════════════════════════════
  @Patch(':id/move')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Move category to new parent (updates entire subtree)',
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.move(id, dto, user.id);
    return { message: 'Category moved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE CATEGORY
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Delete category and all descendants (soft delete)',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.categoryService.remove(id, user.id);
    return { message: 'Category deleted successfully', data: null };
  }
}
