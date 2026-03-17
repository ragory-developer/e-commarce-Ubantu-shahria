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
import { CouponService } from './coupon.service';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ListCouponsDto,
  ValidateCouponDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE COUPON
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_COUPONS)
  @ApiOperation({
    summary: 'Create a new coupon',
    description: 'Requires MANAGE_COUPONS permission',
  })
  async create(@Body() dto: CreateCouponDto, @CurrentUser() user: RequestUser) {
    const data = await this.couponService.create(dto, user.id);
    return { message: 'Coupon created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL COUPONS (ADMIN)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_COUPONS)
  @ApiOperation({
    summary: 'List all coupons with pagination',
    description: 'Requires MANAGE_COUPONS permission',
  })
  async findAll(@Query() dto: ListCouponsDto) {
    const result = await this.couponService.findAll(dto);
    return {
      message: 'Coupons retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // VALIDATE COUPON (PUBLIC - for checkout)
  // ══════════════════════════════════════════════════════════════
  @Post('validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate coupon code (public)',
    description:
      'Check if coupon is valid and applicable. Used during checkout.',
  })
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    const data = await this.couponService.validateCoupon(dto);
    return {
      message: data.valid ? 'Coupon is valid' : 'Coupon is invalid',
      data,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET COUPON BY CODE (PUBLIC - for applying during checkout)
  // ══════════════════════════════════════════════════════════════
  @Get('code/:code')
  @Public()
  @ApiParam({ name: 'code', description: 'Coupon code' })
  @ApiOperation({
    summary: 'Get coupon by code (public)',
    description: 'Retrieve coupon details by code for checkout',
  })
  async findByCode(@Param('code') code: string) {
    const data = await this.couponService.findByCode(code);
    return { message: 'Coupon retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET COUPON BY ID (ADMIN)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_COUPONS)
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiOperation({
    summary: 'Get coupon by ID',
    description: 'Requires MANAGE_COUPONS permission',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.couponService.findOne(id);
    return { message: 'Coupon retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE COUPON
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_COUPONS)
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiOperation({
    summary: 'Update coupon',
    description: 'Requires MANAGE_COUPONS permission',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.couponService.update(id, dto, user.id);
    return { message: 'Coupon updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE COUPON (SOFT DELETE)
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_COUPONS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Coupon ID' })
  @ApiOperation({
    summary: 'Delete coupon (soft delete)',
    description: 'Requires MANAGE_COUPONS permission',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.couponService.remove(id, user.id);
    return { message: 'Coupon deleted successfully', data: null };
  }
}
