// ─── src/attribute/attribute.controller.ts ───────────────────

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
import { AttributeService } from './attribute.service';
import {
  CreateAttributeDto,
  UpdateAttributeDto,
  ListAttributesDto,
  AddAttributeValuesDto,
  UpdateAttributeValuesDto,
  ReorderAttributeValuesDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({ summary: 'Create a new attribute in an attribute set' })
  @ApiResponse({ status: 201, description: 'Attribute created' })
  @ApiResponse({ status: 404, description: 'Attribute set not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict within set' })
  async create(
    @Body() dto: CreateAttributeDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.create(dto, user.id);
    return { success: true, message: 'Attribute created successfully', data };
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_READ)
  @ApiOperation({
    summary: 'List all attributes (admin)',
    description: 'Filter by setId, type. Paginated.',
  })
  async findAll(@Query() dto: ListAttributesDto) {
    const result = await this.attributeService.findAll(dto);
    return {
      success: true,
      message: 'Attributes retrieved successfully',
      ...result,
    };
  }

  @Get('by-set/:attributeSetId')
  @Public()
  @ApiParam({ name: 'attributeSetId', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Get all attributes (with values) for a set (public)',
  })
  @ApiResponse({ status: 200, description: 'Attributes found' })
  @ApiResponse({ status: 404, description: 'Set not found' })
  async findBySet(@Param('attributeSetId') attributeSetId: string) {
    const data = await this.attributeService.findByAttributeSet(attributeSetId);
    return {
      success: true,
      message: 'Attributes retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({ summary: 'Get attribute by ID with all values (admin)' })
  @ApiResponse({ status: 200, description: 'Attribute found' })
  @ApiResponse({ status: 404, description: 'Attribute not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.attributeService.findOne(id);
    return { success: true, message: 'Attribute retrieved successfully', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Update attribute metadata (name, type, position, translations)',
  })
  @ApiResponse({ status: 200, description: 'Attribute updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.update(id, dto, user.id);
    return { success: true, message: 'Attribute updated successfully', data };
  }

  // ─── VALUES ──────────────────────────────────────────────────

  @Post(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Add values to attribute (batch)',
    description:
      'Duplicates are automatically skipped. Returns added + skipped counts.',
  })
  @ApiResponse({ status: 201, description: 'Values added' })
  @ApiResponse({ status: 404, description: 'Attribute not found' })
  async addValues(
    @Param('id') id: string,
    @Body() dto: AddAttributeValuesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.addValues(id, dto, user.id);
    return {
      success: true,
      message: `${data.summary.added} value(s) added, ${data.summary.skippedDuplicates} duplicate(s) skipped`,
      data,
    };
  }

  @Patch(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary:
      'Batch update attribute values (value, label, hexColor, position, translations)',
  })
  @ApiResponse({ status: 200, description: 'Values updated' })
  async updateValues(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeValuesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.updateValues(id, dto, user.id);
    return { success: true, message: `${data.length} value(s) updated`, data };
  }

  @Patch(':id/values/reorder')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({ summary: 'Reorder attribute values' })
  @ApiResponse({ status: 200, description: 'Values reordered' })
  async reorderValues(
    @Param('id') id: string,
    @Body() dto: ReorderAttributeValuesDto,
  ) {
    const data = await this.attributeService.reorderValues(id, dto);
    return { success: true, message: 'Values reordered successfully', data };
  }

  @Delete(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiParam({ name: 'valueId', description: 'Attribute Value ID' })
  @ApiOperation({
    summary: 'Delete attribute value (soft delete)',
    description: 'Blocked if value is used by products.',
  })
  @ApiResponse({ status: 200, description: 'Value deleted' })
  @ApiResponse({ status: 400, description: 'Value is in use by products' })
  async deleteValue(
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.attributeService.deleteValue(id, valueId, user.id);
    return {
      success: true,
      message: 'Attribute value deleted successfully',
      data: null,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Delete attribute + all its values (soft delete)',
    description: 'Blocked if used by products.',
  })
  @ApiResponse({ status: 200, description: 'Attribute deleted' })
  @ApiResponse({ status: 400, description: 'Attribute is in use by products' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.attributeService.remove(id, user.id);
    return {
      success: true,
      message: 'Attribute deleted successfully',
      data: null,
    };
  }
}
