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
import { TagService } from './tag.service';
import { CreateTagDto, UpdateTagDto, ListTagsDto } from './dto';
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
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a new tag',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async create(@Body() dto: CreateTagDto, @CurrentUser() user: RequestUser) {
    const data = await this.tagService.create(dto, user.id);
    return { message: 'Tag created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL TAGS (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all tags with pagination',
    description: 'Public endpoint - no authentication required',
  })
  async findAll(@Query() dto: ListTagsDto) {
    const result = await this.tagService.findAll(dto);
    return {
      message: 'Tags retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY SLUG (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Tag slug' })
  @ApiOperation({
    summary: 'Get tag by slug',
    description: 'Public endpoint - no authentication required',
  })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.tagService.findBySlug(slug);
    return { message: 'Tag retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET TAG BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({
    summary: 'Get tag by ID',
    description: 'Public endpoint - no authentication required',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.tagService.findOne(id);
    return { message: 'Tag retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE TAG
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({
    summary: 'Update tag',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.tagService.update(id, dto, user.id);
    return { message: 'Tag updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE TAG
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Tag ID' })
  @ApiOperation({
    summary: 'Delete tag (soft delete)',
    description:
      'Requires MANAGE_PRODUCTS permission. Cannot delete if tag is used by products.',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.tagService.remove(id, user.id);
    return { message: 'Tag deleted successfully', data: null };
  }
}
