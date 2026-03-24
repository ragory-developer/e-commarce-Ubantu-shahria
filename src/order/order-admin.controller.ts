import {
  Controller,
  Get,
  Post,
  Patch,
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
import { OrderService } from './order.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';
import {
  AdminListOrdersDto,
  UpdateOrderStatusDto,
  CreatePackageDto,
  UpdatePackageStatusDto,
} from './dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class CancelOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

@ApiTags('Admin — Orders')
@ApiBearerAuth('access-token')
@UserType('ADMIN')
@Controller('admin/orders')
export class OrderAdminController {
  constructor(private readonly orderSvc: OrderService) {}

  @Get()
  @Permissions(AdminPermission.ORDER_READ)
  @ApiOperation({ summary: 'List all orders with filters' })
  async listOrders(@Query() dto: AdminListOrdersDto) {
    const data = await this.orderSvc.adminListOrders(dto);
    return { message: 'Orders retrieved', data };
  }

  @Get(':id')
  @Permissions(AdminPermission.ORDER_READ)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get order detail with all relations' })
  async getOrder(@Param('id') id: string) {
    const data = await this.orderSvc.adminGetOrder(id);
    return { message: 'Order retrieved', data };
  }

  @Patch(':id/status')
  @Permissions(AdminPermission.ORDER_UPDATE_STATUS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Update order status (follows valid transition rules)',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.orderSvc.adminUpdateStatus(id, dto, user.id);
    return { message: `Order status → ${dto.status}`, data };
  }

  @Patch(':id/cancel')
  @Permissions(AdminPermission.ORDER_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Cancel order' })
  async cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.orderSvc.adminCancelOrder(id, user.id, dto.reason);
    return { message: 'Order cancelled', data };
  }

  @Post(':id/packages')
  @Permissions(AdminPermission.ORDER_UPDATE_STATUS)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Create a package for order fulfilment' })
  async createPackage(
    @Param('id') id: string,
    @Body() dto: CreatePackageDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.orderSvc.createPackage(id, dto, user.id);
    return { message: 'Package created', data };
  }

  @Patch('packages/:packageId/status')
  @Permissions(AdminPermission.ORDER_UPDATE_STATUS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'packageId' })
  @ApiOperation({
    summary:
      'Update package status (PACKED → ASSIGNED → PICKED_UP → DELIVERED)',
  })
  async updatePackageStatus(
    @Param('packageId') packageId: string,
    @Body() dto: UpdatePackageStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.orderSvc.updatePackageStatus(
      packageId,
      dto,
      user.id,
    );
    return { message: `Package status → ${dto.status}`, data };
  }
}
