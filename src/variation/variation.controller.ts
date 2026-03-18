// ─── src/variation/variation.controller.ts (updated) ─────────

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
import { VariationService } from './variation.service';
import {
  CreateVariationDto,
  UpdateVariationDto,
  ListVariationsDto,
  CreateVariationValueDto,
  UpdateVariationValueDto,
  ReorderValuesDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Variations')
@Controller('variations')
export class VariationController {
  constructor(private readonly variationService: VariationService) {}

  // ── CREATE ──────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiOperation({
    summary: 'Create a new variation (e.g., Size, Color, Material)',
    description:
      'Variations define product options. E.g., "Color" (COLOR type) with values [Red, Blue, Green]. ' +
      'Values can be created inline via the "values" array. ' +
      'Generates a deterministic uid for idempotent operations.',
  })
  @ApiResponse({
    status: 201,
    description: 'Variation created',
    schema: {
      example: {
        success: true,
        data: {
          id: 'clx_var_001',
          uid: 'color',
          name: 'Color',
          type: 'COLOR',
          isGlobal: true,
          position: 0,
          values: [
            {
              id: 'clx_varval_001',
              uid: 'color-red',
              label: 'Red',
              value: '#FF0000',
              position: 0,
            },
            {
              id: 'clx_varval_002',
              uid: 'color-blue',
              label: 'Blue',
              value: '#0000FF',
              position: 1,
            },
          ],
          _count: { values: 2, productVariations: 0 },
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Variation name already exists' })
  async create(
    @Body() dto: CreateVariationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.create(dto, user.id);
    return { success: true, message: 'Variation created successfully', data };
  }

  // ── LIST ────────────────────────────────────────────────────
  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all variations with values (public)',
    description:
      'Returns all product variations with their values. Used on storefront for filters.',
  })
  async findAll(@Query() dto: ListVariationsDto) {
    const result = await this.variationService.findAll(dto);
    return {
      success: true,
      message: 'Variations retrieved successfully',
      data: result.data,
      total: result.total,
      meta: result.meta,
    };
  }

  // ── GET ONE ─────────────────────────────────────────────────
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Get a single variation with all values' })
  @ApiResponse({ status: 200, description: 'Variation found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.variationService.findOne(id);
    return { success: true, message: 'Variation retrieved successfully', data };
  }

  // ── UPDATE ──────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({
    summary: 'Update variation metadata',
    description:
      'Name change will regenerate the uid. Does not affect existing values.',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 409, description: 'Name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVariationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.update(id, dto, user.id);
    return { success: true, message: 'Variation updated successfully', data };
  }

  // ── DELETE ──────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({
    summary: 'Soft delete variation and all its values',
    description: 'Cannot delete if any products use this variation.',
  })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'In use by products' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.variationService.remove(id, user.id);
    return {
      success: true,
      message: 'Variation deleted successfully',
      data: null,
    };
  }

  // ── ADD VALUE ───────────────────────────────────────────────
  @Post(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_CREATE)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({
    summary: 'Add a new value to a variation',
    description:
      'Adds a single value. Duplicate labels (case-insensitive) are rejected. ' +
      'Position is auto-assigned after existing values unless specified.',
  })
  @ApiResponse({ status: 201, description: 'Value added' })
  @ApiResponse({ status: 409, description: 'Duplicate label' })
  async addValue(
    @Param('id') id: string,
    @Body() dto: CreateVariationValueDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.addValue(id, dto, user.id);
    return { success: true, message: 'Value added successfully', data };
  }

  // ── UPDATE VALUE ────────────────────────────────────────────
  @Patch(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiParam({ name: 'valueId', description: 'Value ID' })
  @ApiOperation({
    summary: 'Update a variation value label, value, or position',
  })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 409, description: 'Duplicate label' })
  async updateValue(
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @Body() dto: UpdateVariationValueDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.updateValue(
      id,
      valueId,
      dto,
      user.id,
    );
    return { success: true, message: 'Value updated successfully', data };
  }

  // ── REORDER VALUES ──────────────────────────────────────────
  @Patch(':id/values/reorder')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({
    summary: 'Reorder variation values',
    description:
      'Update display order of values. Provide array of { id, position } objects. ' +
      'All value IDs must belong to this variation.',
  })
  @ApiResponse({ status: 200, description: 'Reordered' })
  @ApiResponse({ status: 400, description: 'Invalid value IDs' })
  async reorderValues(@Param('id') id: string, @Body() dto: ReorderValuesDto) {
    const data = await this.variationService.reorderValues(id, dto);
    return { success: true, message: 'Values reordered successfully', data };
  }

  // ── DELETE VALUE ────────────────────────────────────────────
  @Delete(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiParam({ name: 'valueId', description: 'Value ID' })
  @ApiOperation({
    summary: 'Soft delete a variation value',
    description:
      'Removes the value. Cannot undo without restoring from database.',
  })
  async removeValue(
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.variationService.removeValue(id, valueId, user.id);
    return { success: true, message: 'Value deleted successfully', data: null };
  }
}
