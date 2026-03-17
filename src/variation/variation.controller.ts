// ─── src/variation/variation.controller.ts ────────────────────

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

  // ─── CREATE ─────────────────────────────────────────────────
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({ summary: 'Create a new variation (e.g., Size, Color)' })
  async create(
    @Body() dto: CreateVariationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.create(dto, user.id);
    return { message: 'Variation created successfully', data };
  }

  // ─── LIST ───────────────────────────────────────────────────
  @Get()
  @Public()
  @ApiOperation({ summary: 'List all variations with pagination' })
  async findAll(@Query() dto: ListVariationsDto) {
    const result = await this.variationService.findAll(dto);
    return {
      message: 'Variations retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ─── GET ONE ────────────────────────────────────────────────
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Get a single variation with values' })
  async findOne(@Param('id') id: string) {
    const data = await this.variationService.findOne(id);
    return { message: 'Variation retrieved successfully', data };
  }

  // ─── UPDATE ─────────────────────────────────────────────────
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Update a variation' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVariationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.update(id, dto, user.id);
    return { message: 'Variation updated successfully', data };
  }

  // ─── DELETE ─────────────────────────────────────────────────
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Soft delete a variation' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.variationService.remove(id, user.id);
    return { message: 'Variation deleted successfully', data: null };
  }

  // ─── ADD VALUE ──────────────────────────────────────────────
  @Post(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Add a value to a variation' })
  async addValue(
    @Param('id') id: string,
    @Body() dto: CreateVariationValueDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.variationService.addValue(id, dto, user.id);
    return { message: 'Value added successfully', data };
  }

  // ─── UPDATE VALUE ───────────────────────────────────────────
  @Patch(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiParam({ name: 'valueId', description: 'Value ID' })
  @ApiOperation({ summary: 'Update a variation value' })
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
    return { message: 'Value updated successfully', data };
  }

  // ─── DELETE VALUE ───────────────────────────────────────────
  @Delete(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiParam({ name: 'valueId', description: 'Value ID' })
  @ApiOperation({ summary: 'Soft delete a variation value' })
  async removeValue(
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.variationService.removeValue(id, valueId, user.id);
    return { message: 'Value deleted successfully', data: null };
  }

  // ─── REORDER VALUES ────────────────────────────────────────
  @Patch(':id/values/reorder')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Variation ID' })
  @ApiOperation({ summary: 'Reorder variation values' })
  async reorderValues(
    @Param('id') id: string,
    @Body() dto: ReorderValuesDto,
  ) {
    const data = await this.variationService.reorderValues(id, dto);
    return { message: 'Values reordered successfully', data };
  }
}
