// ─── src/product/product.controller.ts ────────────────────────

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
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ListProductsDto,
  BulkEditVariantDto,
} from './dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ─── CREATE ─────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a product with all relations in a single payload',
  })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.create(dto, user.id);
    return { message: 'Product created successfully', data };
  }

  // ─── LIST ───────────────────────────────────────────────────
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List products with pagination, filters, and optional full detail',
    description:
      'Use ?detail=true to get full product data (same as GET /products/:id). ' +
      'Default returns an enhanced summary with categories, tags, variants, and pricing.',
  })
  async findAll(@Query() dto: ListProductsDto) {
    const result = await this.productService.findAll(dto);
    return {
      message: 'Products retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ─── SEARCH (for linked product dropdowns) ──────────────────
  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search products for dropdown selects' })
  @ApiQuery({ name: 'q', required: true, example: 't-shirt' })
  async search(@Query('q') q: string) {
    const data = await this.productService.search(q);
    return { message: 'Search results', data };
  }

  // ─── GET BY SLUG (for frontend SEO-friendly URLs) ───────────
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Product slug (URL-friendly name)' })
  @ApiOperation({
    summary: 'Get a single product by slug with all relations',
    description:
      'Use this for frontend product detail pages. Returns full product ' +
      'data including media, variants, categories, tags, attributes, etc.',
  })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.productService.findBySlug(slug);
    return { message: 'Product retrieved successfully', data };
  }

  // ─── GET BY CATEGORY SLUG (for storefront category pages) ───
  @Get('category/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiOperation({
    summary: 'Get products by category slug with pagination and filters',
    description:
      'Use this for storefront category pages. Supports all filters ' +
      'including ?detail=true for full product data.',
  })
  async findByCategorySlug(
    @Param('slug') slug: string,
    @Query() dto: ListProductsDto,
  ) {
    const result = await this.productService.findByCategorySlug(slug, dto);
    return {
      message: 'Products retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ─── GET ONE ────────────────────────────────────────────────
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiOperation({ summary: 'Get a single product with all relations' })
  async findOne(@Param('id') id: string) {
    const data = await this.productService.findOne(id);
    return { message: 'Product retrieved successfully', data };
  }

  // ─── UPDATE ─────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.update(id, dto, user.id);
    return { message: 'Product updated successfully', data };
  }

  // ─── DELETE ─────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiOperation({ summary: 'Soft delete a product and its variants' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.productService.remove(id, user.id);
    return { message: 'Product deleted successfully', data: null };
  }

  // ─── BULK EDIT VARIANTS ────────────────────────────────────
  @Patch(':id/variants/bulk')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiOperation({ summary: 'Bulk edit all variants of a product' })
  async bulkEditVariants(
    @Param('id') id: string,
    @Body() dto: BulkEditVariantDto,
  ) {
    const data = await this.productService.bulkEditVariants(id, dto);
    return { message: 'Variants updated successfully', data };
  }

  // ─── UPDATE SINGLE VARIANT ─────────────────────────────────
  @Patch(':id/variants/:variantId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiParam({ name: 'variantId', description: 'Variant ID' })
  @ApiOperation({ summary: 'Update a single variant' })
  async updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.updateVariant(
      id,
      variantId,
      dto,
      user.id,
    );
    return { message: 'Variant updated successfully', data };
  }
}
