// src/admin/admin-returns.controller.ts
// Admin endpoints: Return requests management + Product review moderation

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
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ReturnStatus } from '@prisma/client';
import {
  AdminReturnsService,
  ListReturnsDto,
  ListReviewsAdminDto,
} from './admin-return.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

// ─── Query / Body DTOs ────────────────────────────────────────

class ListReturnsQueryDto implements ListReturnsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

class ReviewReturnBodyDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ['GATEWAY', 'WALLET'], default: 'WALLET' })
  @IsOptional()
  @IsEnum(['GATEWAY', 'WALLET'])
  refundMethod?: 'GATEWAY' | 'WALLET';

  @ApiPropertyOptional({
    example: 250.0,
    description: 'Amount to credit to wallet (if WALLET method)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  walletCreditAmount?: number;
}

class ListReviewsQueryDto implements ListReviewsAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

class ReviewReplyDto {
  @ApiProperty({ example: 'Thank you for your feedback!' })
  @IsString()
  reply!: string;
}

class BulkApproveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  reviewIds!: string[];
}

// ─── CONTROLLER ──────────────────────────────────────────────

@ApiTags('Admin — Returns & Reviews')
@ApiBearerAuth('access-token')
@UserType('ADMIN')
@Controller('admin')
export class AdminReturnsController {
  constructor(private readonly service: AdminReturnsService) {}

  // ══════════════════════════════════════════════════════════════
  // RETURN REQUESTS
  // ══════════════════════════════════════════════════════════════

  @Get('returns')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @ApiOperation({
    summary: 'List all return requests',
    description: 'Filter by status, customer, date range.',
  })
  async listReturns(@Query() dto: ListReturnsQueryDto) {
    const data = await this.service.listReturns(dto);
    return { message: 'Return requests retrieved', data };
  }

  @Get('returns/:id')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Get return request detail with order info and wallet balance',
  })
  async getReturn(@Param('id') id: string) {
    const data = await this.service.getReturnDetail(id);
    return { message: 'Return request retrieved', data };
  }

  @Patch('returns/:id/review')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Approve or reject a return request',
    description:
      'APPROVED: sets refund method and wallet credit amount. ' +
      'REJECTED: closes the request. ' +
      'Actual wallet credit only happens at completeReturn.',
  })
  async reviewReturn(
    @Param('id') id: string,
    @Body() dto: ReviewReturnBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.reviewReturn(id, dto, user.id);
    return { message: `Return ${dto.status.toLowerCase()}`, data };
  }

  @Patch('returns/:id/schedule-pickup')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Schedule pickup for approved return' })
  async schedulePickup(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.approvePickup(id, user.id);
    return { message: 'Pickup scheduled', data };
  }

  @Patch('returns/:id/mark-received')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark return as received at warehouse' })
  async markReceived(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.markReceived(id, user.id);
    return { message: 'Return marked received', data };
  }

  @Post('returns/:id/complete')
  @Permissions(AdminPermission.RETURN_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Complete return — issues wallet refund if applicable',
    description:
      'Marks return as COMPLETED. Credits wallet if refundMethod=WALLET.',
  })
  async completeReturn(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.completeReturn(id, user.id);
    return { message: 'Return completed', data };
  }

  // ══════════════════════════════════════════════════════════════
  // REVIEW MODERATION
  // ══════════════════════════════════════════════════════════════

  @Get('reviews')
  @Permissions(AdminPermission.PRODUCT_READ)
  @ApiOperation({
    summary: 'List all product reviews (admin)',
    description: 'Filter by approval status, product, or star rating.',
  })
  async listReviews(@Query() dto: ListReviewsQueryDto) {
    const data = await this.service.listReviews(dto);
    return { message: 'Reviews retrieved', data };
  }

  @Patch('reviews/:id/approve')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Approve a pending review — makes it public' })
  async approveReview(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.approveReview(id, user.id);
    return { message: 'Review approved', data };
  }

  @Post('reviews/bulk-approve')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk approve multiple reviews at once' })
  async bulkApprove(
    @Body() dto: BulkApproveDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.bulkApproveReviews(dto.reviewIds, user.id);
    return { message: `${data.approved} reviews approved`, data };
  }

  @Delete('reviews/:id')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Reject and remove a review (soft delete)' })
  async rejectReview(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.rejectReview(id, user.id);
    return { message: 'Review rejected', data };
  }

  @Post('reviews/:id/reply')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Add admin reply to a review' })
  async replyToReview(
    @Param('id') id: string,
    @Body() dto: ReviewReplyDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.replyToReview(id, dto.reply, user.id);
    return { message: 'Reply added', data };
  }
}
