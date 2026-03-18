// ─── src/tag/tag.controller.ts ────────────────────────────────

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
import { TagService } from './tag.service';
import {
  CreateTagDto,
  UpdateTagDto,
  ListTagsDto,
  BulkDeleteTagsDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Tags')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE TAG
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create a new tag',
    description:
      'Creates a product tag. Slug and name must be unique (case-insensitive).',
  })
  @ApiResponse({ status: 201, description: 'Tag created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Tag with this slug or name already exists',
  })
  async create(@Body() dto: CreateTagDto, @CurrentUser() user: RequestUser) {
    const data = await this.tagService.create(dto, user.id);
    return {
      success: true,
      message: 'Tag created successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL TAGS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all tags with pagination, search and sort',
    description: 'Public endpoint. Returns paginated tags with product counts.',
  })
  @ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
  async findAll(@Query() dto: ListTagsDto) {
    const result = await this.tagService.findAll(dto);
    return {
      success: true,
      message: 'Tags retrieved successfully',
      data: result.data,
      total: result.total,
      meta: result.meta,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET POPULAR TAGS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('popular')
  @Public()
  @ApiOperation({
    summary: 'Get popular tags sorted by product count',
    description: 'Returns top tags ordered by how many products use them.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Popular tags retrieved' })
  async findPopular(@Query('limit') limit?: string) {
    const data = await this.tagService.findPopular(
      limit ? parseInt(limit) : 20,
    );
    return {
      success: true,
      message: 'Popular tags retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY SLUG (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({
    name: 'slug',
    description: 'Tag URL slug',
    example: 'electronics',
  })
  @ApiOperation({ summary: 'Get tag by slug (public)' })
  @ApiResponse({ status: 200, description: 'Tag found' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.tagService.findBySlug(slug);
    return {
      success: true,
      message: 'Tag retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({ summary: 'Get tag by ID (public)' })
  @ApiResponse({ status: 200, description: 'Tag found' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.tagService.findOne(id);
    return {
      success: true,
      message: 'Tag retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE TAG
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({ summary: 'Update tag name, slug or translations' })
  @ApiResponse({ status: 200, description: 'Tag updated successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  @ApiResponse({ status: 409, description: 'Slug or name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.tagService.update(id, dto, user.id);
    return {
      success: true,
      message: 'Tag updated successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE TAG
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({
    summary: 'Soft delete a tag',
    description: 'Cannot delete if tag has products assigned.',
  })
  @ApiResponse({ status: 200, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 400, description: 'Tag has products — cannot delete' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.tagService.remove(id, user.id);
    return {
      success: true,
      message: 'Tag deleted successfully',
      data: null,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // BULK DELETE TAGS
  // ══════════════════════════════════════════════════════════════
  @Post('bulk-delete')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk soft delete tags',
    description:
      'Deletes multiple tags. Tags with products are skipped and reported.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed with per-tag results',
  })
  async bulkDelete(
    @Body() dto: BulkDeleteTagsDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.tagService.bulkDelete(dto, user.id);
    return {
      success: true,
      message: `Bulk delete completed: ${data.deleted} deleted, ${data.failed} failed`,
      data,
    };
  }
}
