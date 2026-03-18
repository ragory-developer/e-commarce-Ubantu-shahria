// ─── src/category/category.controller.ts ─────────────────────

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
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesDto,
  MoveCategoryDto,
  ReorderCategoriesDto,
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
  // CREATE
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create a new category',
    description:
      'Creates a category. Nesting up to 5 levels deep. Materialized path is auto-computed.',
  })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  @ApiResponse({
    status: 400,
    description: 'Max depth exceeded or invalid media',
  })
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.create(dto, user.id);
    return { success: true, message: 'Category created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // LIST (PUBLIC) — flat
  // ══════════════════════════════════════════════════════════════
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List categories (flat, paginated)',
    description:
      'Filter by parentId, rootOnly, isActive. Supports search and sort.',
  })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  async findAll(@Query() dto: ListCategoriesDto) {
    const result = await this.categoryService.findAll(dto);
    return {
      success: true,
      message: 'Categories retrieved successfully',
      ...result,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // FULL TREE (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('tree')
  @Public()
  @ApiOperation({
    summary: 'Get full nested category tree',
    description:
      'Returns root categories with recursively nested children. Use ?activeOnly=true to filter.',
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Show only active categories',
  })
  @ApiResponse({ status: 200, description: 'Category tree retrieved' })
  async getTree(@Query('activeOnly') activeOnly?: string) {
    const data = await this.categoryService.getTree(activeOnly === 'true');
    return {
      success: true,
      message: 'Category tree retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY SLUG (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'electronics' })
  @ApiOperation({
    summary: 'Get category by slug (public)',
    description: 'Returns category with breadcrumbs, children, and media.',
  })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.categoryService.findBySlug(slug);
    return { success: true, message: 'Category retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // BREADCRUMBS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id/breadcrumbs')
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({ summary: 'Get breadcrumb trail (root → current category)' })
  @ApiResponse({ status: 200, description: 'Breadcrumbs retrieved' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getBreadcrumbs(@Param('id') id: string) {
    const data = await this.categoryService.getBreadcrumbs(id);
    return {
      success: true,
      message: 'Breadcrumbs retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // ANCESTORS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id/ancestors')
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Get all ancestor categories (not including current)',
  })
  @ApiResponse({ status: 200, description: 'Ancestors retrieved' })
  async getAncestors(@Param('id') id: string) {
    const data = await this.categoryService.getAncestors(id);
    return { success: true, message: 'Ancestors retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DESCENDANTS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id/descendants')
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({ summary: 'Get all descendant categories as a flat list' })
  @ApiResponse({ status: 200, description: 'Descendants retrieved' })
  async getDescendants(@Param('id') id: string) {
    const data = await this.categoryService.getDescendants(id);
    return {
      success: true,
      message: 'Descendants retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // STATS (ADMIN)
  // ══════════════════════════════════════════════════════════════
  @Get(':id/stats')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Get category statistics (admin)',
    description: 'Product counts, child counts, descendant counts.',
  })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getStats(@Param('id') id: string) {
    const data = await this.categoryService.getStats(id);
    return { success: true, message: 'Category stats retrieved', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Get category by ID (public)',
    description: 'Includes breadcrumbs, children and media.',
  })
  @ApiResponse({ status: 200, description: 'Category found' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.categoryService.findOne(id);
    return { success: true, message: 'Category retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Update category',
    description: 'Slug change will automatically rebuild descendant paths.',
  })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.update(id, dto, user.id);
    return { success: true, message: 'Category updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // MOVE
  // ══════════════════════════════════════════════════════════════
  @Patch(':id/move')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Move category to a new parent',
    description:
      'Rebuilds materialized paths for the entire moved subtree. Cannot move to own descendant.',
  })
  @ApiResponse({ status: 200, description: 'Category moved' })
  @ApiResponse({
    status: 400,
    description: 'Circular reference or max depth exceeded',
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.move(id, dto, user.id);
    return { success: true, message: 'Category moved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // REORDER
  // ══════════════════════════════════════════════════════════════
  @Patch('reorder')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories within the same parent level' })
  @ApiResponse({ status: 200, description: 'Categories reordered' })
  async reorder(
    @Body() dto: ReorderCategoriesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.categoryService.reorder(dto, user.id);
    return {
      success: true,
      message: 'Categories reordered successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiOperation({
    summary: 'Soft delete category and all descendants',
    description: 'Cannot delete if category or any descendant has products.',
  })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 400, description: 'Category has products' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.categoryService.remove(id, user.id);
    return {
      success: true,
      message: 'Category deleted successfully',
      data: null,
    };
  }
}
