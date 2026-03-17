import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import {
  UpdateCustomerProfileDto,
  ChangePasswordDto,
  UpgradeGuestDto,
} from './dto';
import { AUTH_CONFIG, AUTH_ERROR } from '../auth/auth.constants';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TokenService))
    private readonly tokenService: TokenService,
  ) {}

  // ─── Get profile ──────────────────────────────────────────────
  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        isActive: true,
        avatar: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);
    return customer;
  }

  // ─── Update own profile ───────────────────────────────────────
  // Note: phone changes are NOT allowed (it's the primary identifier).
  async updateProfile(
    customerId: string,
    dto: UpdateCustomerProfileDto,
  ): Promise<object> {
    await this.getProfile(customerId); // ensure exists

    // Email uniqueness check
    if (dto.email) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (emailTaken)
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email && { email: dto.email, emailVerified: false }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        avatar: true,
        isGuest: true,
      },
    });
  }

  // ─── Change password (must know current) ─────────────────────
  async changePassword(
    customerId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, password: true, isGuest: true },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    if (customer.isGuest || !customer.password) {
      throw new BadRequestException(
        'No password set on this account. Use upgrade-to-account instead.',
      );
    }

    const valid = await bcrypt.compare(dto.currentPassword, customer.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { password: hashed },
    });

    // Revoke all other sessions
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(`Password changed for customer ${customerId}`);
  }

  // ─── Upgrade guest → full account ─────────────────────────────
  // Requirements:
  //   1. Customer must be a guest (isGuest: true)
  //   2. Phone must already be verified (phoneVerified: true)
  //      — Guest verifies phone via POST /auth/customer/verify-phone/*
  //   3. Set password and name → account becomes full
  async upgradeGuest(
    customerId: string,
    dto: UpgradeGuestDto,
  ): Promise<object> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        isGuest: true,
        phoneVerified: true,
        phone: true,
        email: true,
      },
    });

    if (!customer) throw new NotFoundException(AUTH_ERROR.CUSTOMER_NOT_FOUND);

    if (!customer.isGuest) {
      throw new BadRequestException('Account is already a full account');
    }

    if (!customer.phoneVerified) {
      throw new ForbiddenException(
        'Phone must be verified before upgrading. Use POST /auth/customer/verify-phone/request first.',
      );
    }

    // Check email uniqueness if provided
    if (dto.email) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (emailTaken)
        throw new ConflictException(AUTH_ERROR.CUSTOMER_EMAIL_TAKEN);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isGuest: false,
        password: hashedPassword,
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email && { email: dto.email, emailVerified: false }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneVerified: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        createdAt: true,
      },
    });

    this.logger.log(`Guest ${customerId} upgraded to full account`);
    return updated;
  }

  // ─── Deactivate own account (soft) ───────────────────────────
  async deactivateAccount(customerId: string): Promise<void> {
    await this.getProfile(customerId);

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    // Revoke all sessions
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(`Customer ${customerId} deactivated their account`);
  }
}
