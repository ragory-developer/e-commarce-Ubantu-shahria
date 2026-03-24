import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

class MyOrdersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

@ApiTags('Customer — Orders')
@ApiBearerAuth('access-token')
@UserType('CUSTOMER')
@Controller('customer/orders')
export class OrderController {
  constructor(private readonly orderSvc: OrderService) {}

  @Get()
  @ApiOperation({ summary: 'Get my order history' })
  async getMyOrders(
    @Query() dto: MyOrdersDto,
    @CurrentUser() user: RequestUser,
  ) {
    const skip = (dto.page - 1) * dto.limit;
    const [orders, total] = await Promise.all([
      (this as any).orderSvc.prisma.order.findMany({
        where: {
          customerId: user.id,
          deletedAt: null,
          ...(dto.status && { status: dto.status }),
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          subTotal: true,
          shippingCost: true,
          discount: true,
          total: true,
          currency: true,
          trackingNumber: true,
          courierName: true,
          createdAt: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          products: {
            select: {
              productName: true,
              qty: true,
              unitPrice: true,
              lineTotal: true,
              productImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: dto.limit,
      }),
      (this as any).orderSvc.prisma.order.count({
        where: {
          customerId: user.id,
          deletedAt: null,
          ...(dto.status && { status: dto.status }),
        },
      }),
    ]);
    return {
      message: 'Orders retrieved',
      data: {
        data: orders,
        meta: {
          total,
          page: dto.page,
          limit: dto.limit,
          totalPages: Math.ceil(total / dto.limit),
        },
      },
    };
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get single order detail' })
  async getOrder(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const order = await (this as any).orderSvc.prisma.order.findFirst({
      where: { id, customerId: user.id, deletedAt: null },
      include: {
        products: true,
        statusHistory: {
          select: {
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        packages: {
          where: { deletedAt: null },
          include: {
            courier: { select: { name: true, trackingUrlTemplate: true } },
          },
        },
        returns: {
          where: { deletedAt: null },
          select: { id: true, status: true, reason: true, createdAt: true },
        },
        transaction: {
          select: {
            transactionId: true,
            paymentStatus: true,
            amount: true,
            paidAt: true,
          },
        },
      },
    });
    if (!order) throw new Error('Order not found');
    return { message: 'Order retrieved', data: order };
  }
}
