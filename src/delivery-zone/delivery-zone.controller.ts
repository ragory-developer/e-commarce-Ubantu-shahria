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
import { DeliveryZoneService } from './delivery-zone.service';
import {
  CreateDeliveryZoneDto,
  UpdateDeliveryZoneDto,
  ListDeliveryZonesDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class AssignAreasDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  areaIds!: string[];
}

@ApiTags('Delivery Zones')
@Controller('delivery-zones')
export class DeliveryZoneController {
  constructor(private readonly service: DeliveryZoneService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiOperation({ summary: 'Create a delivery zone' })
  async create(
    @Body() dto: CreateDeliveryZoneDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(dto, user.id);
    return { message: 'Delivery zone created', data };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List delivery zones (public)' })
  async findAll(@Query() dto: ListDeliveryZonesDto) {
    const result = await this.service.findAll(dto);
    return {
      message: 'Delivery zones retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug' })
  @ApiOperation({ summary: 'Get delivery zone by slug with shipping rates' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.service.findBySlug(slug);
    return { message: 'Delivery zone retrieved', data };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get delivery zone with areas and shipping rules' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { message: 'Delivery zone retrieved', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update delivery zone' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryZoneDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.update(id, dto, user.id);
    return { message: 'Delivery zone updated', data };
  }

  @Patch(':id/areas')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Assign/replace areas for this delivery zone' })
  async assignAreas(
    @Param('id') id: string,
    @Body() dto: AssignAreasDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.assignAreas(id, dto.areaIds, user.id);
    return { message: 'Areas assigned to delivery zone', data };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Delete delivery zone (soft delete, unassigns areas)',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.remove(id, user.id);
    return { message: 'Delivery zone deleted', data: null };
  }
}
