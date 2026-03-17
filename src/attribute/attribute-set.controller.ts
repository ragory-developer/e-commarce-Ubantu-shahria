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
import { AttributeSetService } from './attribute-set.service';
import {
  CreateAttributeSetDto,
  UpdateAttributeSetDto,
  ListAttributeSetsDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Attribute Sets')
@Controller('attribute-sets')
export class AttributeSetController {
  constructor(private readonly attributeSetService: AttributeSetService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a new attribute set',
    description: 'e.g., "Laptop Specifications", "Watch Specifications"',
  })
  async create(
    @Body() dto: CreateAttributeSetDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeSetService.create(dto, user.id);
    return {
      message: 'Attribute set created successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL ATTRIBUTE SETS
  // ══════════════════════════════════════════════════════════════
  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({ summary: 'List all attribute sets with pagination' })
  async findAll(@Query() dto: ListAttributeSetsDto) {
    const result = await this.attributeSetService.findAll(dto);
    return {
      message: 'Attribute sets retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ATTRIBUTE SET BY ID
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Get attribute set with all its attributes and values',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.attributeSetService.findOne(id);
    return {
      message: 'Attribute set retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ATTRIBUTE SET BY SLUG
  // ══════════════════════════════════════════════════════════════
  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', description: 'Attribute Set slug' })
  @ApiOperation({
    summary: 'Get attribute set by slug (public)',
    description: 'Returns full attribute structure with all values',
  })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.attributeSetService.findBySlug(slug);
    return {
      message: 'Attribute set retrieved successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({ summary: 'Update attribute set name/slug/translations' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeSetDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeSetService.update(id, dto, user.id);
    return {
      message: 'Attribute set updated successfully',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE ATTRIBUTE SET
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Delete attribute set (soft delete)',
    description: 'Cannot delete if attributes are in use by products',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.attributeSetService.remove(id, user.id);
    return { message: 'Attribute set deleted successfully', data: null };
  }
}
