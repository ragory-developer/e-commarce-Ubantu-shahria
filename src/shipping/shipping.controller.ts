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
  ApiBody,
} from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import {
  CreateShippingRuleDto,
  UpdateShippingRuleDto,
  ListShippingRulesDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CalculateShippingDto {
  @ApiProperty({ example: 'clx_zone_001' })
  @IsString()
  @IsNotEmpty()
  deliveryZoneId!: string;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartTotal!: number;

  @ApiProperty({ example: 1.5, description: 'Total weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalWeight?: number;

  @ApiProperty({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  itemCount?: number;
}

@ApiTags('Shipping Rules')
@Controller('shipping-rules')
export class ShippingController {
  constructor(private readonly service: ShippingService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiOperation({ summary: 'Create shipping rule (zone × courier)' })
  async create(
    @Body() dto: CreateShippingRuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(dto, user.id);
    return { message: 'Shipping rule created', data };
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiOperation({ summary: 'List all shipping rules with filters' })
  async findAll(@Query() dto: ListShippingRulesDto) {
    const result = await this.service.findAll(dto);
    return {
      message: 'Shipping rules retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get shipping rule by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { message: 'Shipping rule retrieved', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update shipping rule' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShippingRuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.update(id, dto, user.id);
    return { message: 'Shipping rule updated', data };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_SHIPPING)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Delete shipping rule (soft delete)' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.remove(id, user.id);
    return { message: 'Shipping rule deleted', data: null };
  }

  @Post('calculate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Public] Calculate shipping options for a cart',
    description:
      'Returns available couriers and their costs for a delivery zone. Call this during checkout.',
  })
  async calculate(@Body() dto: CalculateShippingDto) {
    const data = await this.service.calculateShippingOptions({
      deliveryZoneId: dto.deliveryZoneId,
      cartTotal: dto.cartTotal,
      totalWeight: dto.totalWeight,
      itemCount: dto.itemCount,
    });
    return { message: 'Shipping options calculated', data };
  }
}
