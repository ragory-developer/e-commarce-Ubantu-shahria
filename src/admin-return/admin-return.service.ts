// src/admin/admin-returns.service.ts
// Admin management of return requests and product reviews

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnStatus, Prisma } from '@prisma/client';

// ─── DTOs ─────────────────────────────────────────────────────

export class ListReturnsDto {
  page: number = 1;
  limit: number = 20;
  status?: ReturnStatus;
  fromDate?: string;
  toDate?: string;
  customerId?: string;
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ReviewReturnDto {
  status!: 'APPROVED' | 'REJECTED';
  note?: string;
  refundMethod?: 'GATEWAY' | 'WALLET';
  walletCreditAmount?: number;
}

export class ListReviewsAdminDto {
  page: number = 1;
  limit: number = 20;
  isApproved?: boolean;
  productId?: string;
  rating?: number;
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─── SERVICE ──────────────────────────────────────────────────

@Injectable()
export class AdminReturnsService {
  private readonly logger = new Logger(AdminReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // RETURNS
  // ══════════════════════════════════════════════════════════════

  async listReturns(dto: ListReturnsDto) {
    const skip = (dto.page - 1) * dto.limit;
    const where: Prisma.OrderReturnWhereInput = { deletedAt: null };

    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;

    if (dto.fromDate || dto.toDate) {
      where.createdAt = {};
      if (dto.fromDate) (where.createdAt as any).gte = new Date(dto.fromDate);
      if (dto.toDate) {
        const to = new Date(dto.toDate);
        to.setHours(23, 59, 59, 999);
        (where.createdAt as any).lte = to;
      }
    }

    const [returns, total] = await Promise.all([
      this.prisma.orderReturn.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true,
              currency: true,
              customerFirstName: true,
              customerLastName: true,
              customerPhone: true,
            },
          },
          customer: {
            select: { id: true, phone: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: dto.sortOrder ?? 'desc' },
        skip,
        take: dto.limit,
      }),
      this.prisma.orderReturn.count({ where }),
    ]);

    return {
      data: returns,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
        hasNextPage: skip + dto.limit < total,
        hasPrevPage: dto.page > 1,
      },
    };
  }

  async getReturnDetail(id: string) {
    const ret = await this.prisma.orderReturn.findFirst({
      where: { id, deletedAt: null },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            paymentMethod: true,
            shippingAddress: true,
            products: {
              select: {
                id: true,
                productName: true,
                productSku: true,
                unitPrice: true,
                qty: true,
                lineTotal: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            phone: true,
            email: true,
            firstName: true,
            lastName: true,
            wallet: { select: { balance: true, currency: true } },
          },
        },
      },
    });

    if (!ret) throw new NotFoundException('Return request not found');
    return ret;
  }

  async reviewReturn(id: string, dto: ReviewReturnDto, adminId: string) {
    const ret = await this.prisma.orderReturn.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, customerId: true, items: true },
    });
    if (!ret) throw new NotFoundException('Return request not found');

    if (ret.status !== 'REQUESTED') {
      throw new BadRequestException(
        `Return is already ${ret.status}. Only REQUESTED returns can be reviewed.`,
      );
    }

    const newStatus =
      dto.status === 'APPROVED' ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;

    await this.prisma.orderReturn.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: dto.note ?? null,
        refundMethod:
          dto.status === 'APPROVED' ? (dto.refundMethod ?? 'WALLET') : null,
        walletCreditAmount:
          dto.status === 'APPROVED' && dto.walletCreditAmount
            ? new Prisma.Decimal(dto.walletCreditAmount)
            : null,
      },
    });

    this.logger.log(
      `Return ${id} ${dto.status.toLowerCase()} by admin ${adminId}`,
    );
    return this.getReturnDetail(id);
  }

  async approvePickup(id: string, adminId: string) {
    const ret = await this.prisma.orderReturn.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (ret.status !== 'APPROVED') {
      throw new BadRequestException(
        'Return must be APPROVED before scheduling pickup',
      );
    }

    await this.prisma.orderReturn.update({
      where: { id },
      data: { status: 'PICKUP_SCHEDULED' },
    });

    return { message: 'Pickup scheduled' };
  }

  async markReceived(id: string, adminId: string) {
    const ret = await this.prisma.orderReturn.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!ret) throw new NotFoundException('Return not found');

    await this.prisma.orderReturn.update({
      where: { id },
      data: { status: 'RECEIVED' },
    });

    return { message: 'Return marked as received' };
  }

  async completeReturn(id: string, adminId: string) {
    const ret = await this.prisma.orderReturn.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        customerId: true,
        walletCreditAmount: true,
        refundMethod: true,
      },
    });
    if (!ret) throw new NotFoundException('Return not found');
    if (!['INSPECTED', 'RECEIVED'].includes(ret.status)) {
      throw new BadRequestException(
        'Return must be RECEIVED/INSPECTED before completing',
      );
    }

    // Credit wallet if refund method is wallet
    if (
      ret.refundMethod === 'WALLET' &&
      ret.customerId &&
      ret.walletCreditAmount &&
      ret.walletCreditAmount.toNumber() > 0
    ) {
      await this.creditWallet(
        ret.customerId,
        ret.walletCreditAmount.toNumber(),
        id,
        adminId,
      );
    }

    await this.prisma.orderReturn.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    this.logger.log(`Return ${id} completed by admin ${adminId}`);
    return { message: 'Return completed' };
  }

  private async creditWallet(
    customerId: string,
    amount: number,
    returnId: string,
    adminId: string,
  ) {
    const wallet = await this.prisma.wallet.upsert({
      where: { customerId },
      create: { customerId, balance: 0, isActive: true },
      update: {},
    });

    const newBalance = wallet.balance.toNumber() + amount;
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(newBalance) },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT_REFUND',
          amount: new Prisma.Decimal(amount),
          balance: new Prisma.Decimal(newBalance),
          returnId,
          description: `Refund for return #${returnId}`,
          createdBy: adminId,
        },
      }),
    ]);
  }

  // ══════════════════════════════════════════════════════════════
  // REVIEWS
  // ══════════════════════════════════════════════════════════════

  async listReviews(dto: ListReviewsAdminDto) {
    const skip = (dto.page - 1) * dto.limit;
    const where: Prisma.ReviewWhereInput = { deletedAt: null };

    if (dto.isApproved !== undefined) where.isApproved = dto.isApproved;
    if (dto.productId) where.productId = dto.productId;
    if (dto.rating) where.rating = dto.rating;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          reviewerName: true,
          isApproved: true,
          adminReply: true,
          createdAt: true,
          updatedAt: true,
          product: { select: { id: true, name: true, slug: true } },
          reviewer: { select: { id: true, phone: true, firstName: true } },
        },
        orderBy: { createdAt: dto.sortOrder ?? 'desc' },
        skip,
        take: dto.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
        hasNextPage: skip + dto.limit < total,
        hasPrevPage: dto.page > 1,
      },
    };
  }

  async approveReview(reviewId: string, adminId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true, productId: true, isApproved: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.isApproved) return { message: 'Review already approved' };

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });

    // Recompute product rating
    await this.recomputeRating(review.productId);
    return { message: 'Review approved' };
  }

  async bulkApproveReviews(reviewIds: string[], adminId: string) {
    await this.prisma.review.updateMany({
      where: { id: { in: reviewIds }, deletedAt: null },
      data: { isApproved: true },
    });

    // Recompute ratings for affected products
    const reviews = await this.prisma.review.findMany({
      where: { id: { in: reviewIds } },
      select: { productId: true },
    });
    const productIds = [...new Set(reviews.map((r) => r.productId))];
    await Promise.all(productIds.map((pid) => this.recomputeRating(pid)));

    return { approved: reviewIds.length };
  }

  async rejectReview(reviewId: string, adminId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true, productId: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.softDelete('review', reviewId, adminId);
    await this.recomputeRating(review.productId);
    return { message: 'Review rejected and removed' };
  }

  async replyToReview(reviewId: string, reply: string, adminId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        adminReply: {
          reply,
          repliedAt: new Date().toISOString(),
          repliedBy: adminId,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, adminReply: true, updatedAt: true },
    });
  }

  private async recomputeRating(productId: string) {
    const result = await this.prisma.review.aggregate({
      where: { productId, isApproved: true, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: result._avg.rating
          ? new Prisma.Decimal(result._avg.rating.toFixed(2))
          : null,
        reviewCount: result._count.rating,
      },
    });
  }
}
