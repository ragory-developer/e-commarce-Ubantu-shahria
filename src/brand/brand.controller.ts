// ─── src/brand/brand.controller.ts ───────────────────────────

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
  ApiResponse,
} from '@nestjs/swagger';
import { BrandService } from './brand.service';
import {
  CreateBrandDto,
  UpdateBrandDto,
  ListBrandsDto,
  BulkDeleteBrandsDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  // CREATE
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create a new brand',
    description: 'Slug and name must be globally unique.',
  })
  @ApiResponse({ status: 201, description: 'Brand created' })
  @ApiResponse({ status: 409, description: 'Slug or name conflict' })
  async create(@Body() dto: CreateBrandDto, @CurrentUser() user: RequestUser) {
    const data = await this.brandService.create(dto, user.id);
    return { success: true, message: 'Brand created successfully', data };
  }

  // LIST (PUBLIC)
  @Get()
  @Public()
  @ApiOperation({ summary: 'List all brands with pagination & search' })
  @ApiResponse({ status: 200, description: 'Brands retrieved' })
  async findAll(@Query() dto: ListBrandsDto) {
    const result = await this.brandService.findAll(dto);
    return {
      success: true,
      message: 'Brands retrieved successfully',
      ...result,
    };
  }

  // GET BY SLUG (PUBLIC)
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'samsung' })
  @ApiOperation({ summary: 'Get brand by slug (public)' })
  @ApiResponse({ status: 200, description: 'Brand found' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.brandService.findBySlug(slug);
    return { success: true, message: 'Brand retrieved successfully', data };
  }

  // GET STATS (ADMIN)
  @Get(':id/stats')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({
    summary: 'Get brand statistics (admin)',
    description: 'Total, active, inactive product counts.',
  })
  @ApiResponse({ status: 200, description: 'Brand stats retrieved' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async getStats(@Param('id') id: string) {
    const data = await this.brandService.getStats(id);
    return { success: true, message: 'Brand stats retrieved', data };
  }

  // GET BY ID (PUBLIC)
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({ summary: 'Get brand by ID (public)' })
  @ApiResponse({ status: 200, description: 'Brand found' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.brandService.findOne(id);
    return { success: true, message: 'Brand retrieved successfully', data };
  }

  // UPDATE
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({ summary: 'Update brand details' })
  @ApiResponse({ status: 200, description: 'Brand updated' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({ status: 409, description: 'Slug or name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.brandService.update(id, dto, user.id);
    return { success: true, message: 'Brand updated successfully', data };
  }

  // DELETE
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({
    summary: 'Soft delete brand',
    description: 'Blocked if brand has active products.',
  })
  @ApiResponse({ status: 200, description: 'Brand deleted' })
  @ApiResponse({ status: 400, description: 'Has active products' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.brandService.remove(id, user.id);
    return { success: true, message: 'Brand deleted successfully', data: null };
  }

  // BULK DELETE
  @Post('bulk-delete')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk soft delete brands',
    description: 'Returns per-brand results.',
  })
  @ApiResponse({ status: 200, description: 'Bulk delete completed' })
  async bulkDelete(
    @Body() dto: BulkDeleteBrandsDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.brandService.bulkDelete(dto, user.id);
    return {
      success: true,
      message: `Bulk delete: ${data.deleted} deleted, ${data.failed} failed`,
      data,
    };
  }
}
