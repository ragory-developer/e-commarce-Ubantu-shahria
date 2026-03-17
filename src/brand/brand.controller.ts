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
import { BrandService } from './brand.service';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto';
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

  // ══════════════════════════════════════════════════════════════
  // CREATE BRAND
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a new brand',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async create(
    @Body() dto: CreateBrandDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.brandService.create(dto, user.id);
    return { message: 'Brand created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL BRANDS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all brands with pagination',
    description: 'Public endpoint - no authentication required',
  })
  async findAll(@Query() dto: ListBrandsDto) {
    const result = await this.brandService.findAll(dto);
    return {
      message: 'Brands retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND BY SLUG (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Brand slug' })
  @ApiOperation({
    summary: 'Get brand by slug',
    description: 'Public endpoint - no authentication required',
  })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.brandService.findBySlug(slug);
    return { message: 'Brand retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BRAND BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({
    summary: 'Get brand by ID',
    description: 'Public endpoint - no authentication required',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.brandService.findOne(id);
    return { message: 'Brand retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE BRAND
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({
    summary: 'Update brand',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.brandService.update(id, dto, user.id);
    return { message: 'Brand updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE BRAND
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiOperation({
    summary: 'Delete brand (soft delete)',
    description: 'Requires MANAGE_PRODUCTS permission. Cannot delete if brand has active products.',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.brandService.remove(id, user.id);
    return { message: 'Brand deleted successfully', data: null };
  }
}
