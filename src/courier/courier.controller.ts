// src/courier/courier.controller.ts

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
import {
  CourierService,
  CreateCourierDto,
  UpdateCourierDto,
  ListCouriersDto,
} from './courier.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Couriers')
@Controller('couriers')
export class CourierController {
  constructor(private readonly service: CourierService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiOperation({ summary: 'Create a courier (admin)' })
  async create(
    @Body() dto: CreateCourierDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(dto, user.id);
    return { message: 'Courier created', data };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List couriers (public — for checkout)' })
  async findAll(@Query() dto: ListCouriersDto) {
    const result = await this.service.findAll(dto);
    return {
      message: 'Couriers retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug' })
  @ApiOperation({ summary: 'Get courier by slug (public)' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.service.findBySlug(slug);
    return { message: 'Courier retrieved', data };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get courier by ID with shipping rules (admin)' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { message: 'Courier retrieved', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update courier details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourierDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.update(id, dto, user.id);
    return { message: 'Courier updated', data };
  }

  @Patch(':id/toggle-active')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Toggle courier active/inactive status' })
  async toggleActive(@Param('id') id: string) {
    const data = await this.service.toggleActive(id);
    return {
      message: `Courier ${data.isActive ? 'activated' : 'deactivated'}`,
      data,
    };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soft delete courier' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.remove(id, user.id);
    return { message: 'Courier deleted', data: null };
  }
}
