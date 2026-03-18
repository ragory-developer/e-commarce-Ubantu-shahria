// ─── src/attribute/attribute-set.controller.ts ───────────────

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

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create attribute set',
    description: 'e.g. "Laptop Specifications", "Clothing Properties"',
  })
  @ApiResponse({ status: 201, description: 'Attribute set created' })
  @ApiResponse({ status: 409, description: 'Name or slug conflict' })
  async create(
    @Body() dto: CreateAttributeSetDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeSetService.create(dto, user.id);
    return {
      success: true,
      message: 'Attribute set created successfully',
      data,
    };
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_READ)
  @ApiOperation({ summary: 'List all attribute sets (admin)' })
  async findAll(@Query() dto: ListAttributeSetsDto) {
    const result = await this.attributeSetService.findAll(dto);
    return {
      success: true,
      message: 'Attribute sets retrieved successfully',
      ...result,
    };
  }

  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'laptop-specifications' })
  @ApiOperation({
    summary: 'Get attribute set by slug with all attributes & values (public)',
  })
  @ApiResponse({ status: 200, description: 'Attribute set found' })
  @ApiResponse({ status: 404, description: 'Attribute set not found' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.attributeSetService.findBySlug(slug);
    return {
      success: true,
      message: 'Attribute set retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Get attribute set by ID with all attributes & values (admin)',
  })
  @ApiResponse({ status: 200, description: 'Attribute set found' })
  @ApiResponse({ status: 404, description: 'Attribute set not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.attributeSetService.findOne(id);
    return {
      success: true,
      message: 'Attribute set retrieved successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({ summary: 'Update attribute set' })
  @ApiResponse({ status: 200, description: 'Attribute set updated' })
  @ApiResponse({ status: 409, description: 'Name or slug conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeSetDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeSetService.update(id, dto, user.id);
    return {
      success: true,
      message: 'Attribute set updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Delete attribute set',
    description: 'Blocked if set has attributes.',
  })
  @ApiResponse({ status: 200, description: 'Attribute set deleted' })
  @ApiResponse({ status: 400, description: 'Has attributes — cannot delete' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.attributeSetService.remove(id, user.id);
    return {
      success: true,
      message: 'Attribute set deleted successfully',
      data: null,
    };
  }
}
