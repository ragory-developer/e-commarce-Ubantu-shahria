// ─── src/admin/admin.service.ts ──────────────────────────────
// Production-ready admin service with customer management

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AdminRole, AdminPermission } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import {
  CreateAdminDto,
  UpdateAdminPermissionsDto,
  UpdateAdminRoleDto,
  UpdateAdminProfileDto,
  AdminChangePasswordDto,
  ListCustomersDto,
  ListGuestCustomersDto,
  AdminUpdateCustomerDto,
  AdminResetCustomerPasswordDto,
  BulkCustomerActionDto,
  CreateCustomerNoteDto,
  UpdateCustomerNoteDto,
  CreateCustomerTagDto,
  DashboardQueryDto,
} from './dto';
import { AUTH_CONFIG, AUTH_ERROR } from '../auth/auth.constants';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TokenService))
    private readonly tokenService: TokenService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // ADMIN SELF — OWN PROFILE
  // ══════════════════════════════════════════════════════════════

  async getProfile(adminId: string) {
    const admin = await this.prisma.admin.findFirst({
      where: { id: adminId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!admin) throw new NotFoundException(AUTH_ERROR.ADMIN_NOT_FOUND);
    return admin;
  }

  async updateProfile(adminId: string, dto: UpdateAdminProfileDto) {
    await this.getProfile(adminId);

    return this.prisma.admin.update({
      where: { id: adminId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(
    adminId: string,
    dto: AdminChangePasswordDto,
  ): Promise<void> {
    const admin = await this.prisma.admin.findFirst({
      where: { id: adminId, deletedAt: null },
      select: { id: true, password: true },
    });
    if (!admin) throw new NotFoundException(AUTH_ERROR.ADMIN_NOT_FOUND);

    const valid = await bcrypt.compare(dto.currentPassword, admin.password);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { password: hashed },
    });

    // Revoke all sessions — force re-login everywhere
    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      adminId,
      'All_DEVICES',
    );
    this.logger.log(`Admin ${adminId} changed their password`);
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN MANAGEMENT — SUPERADMIN ONLY
  // ══════════════════════════════════════════════════════════════

  async createAdmin(
    dto: CreateAdminDto,
    callerRole: AdminRole,
    createdBy: string,
  ) {
    this.requireSuperAdmin(callerRole);

    if (dto.role === AdminRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot create another SUPERADMIN');
    }

    const exists = await this.prisma.admin.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      select: { id: true },
    });
    if (exists) throw new ConflictException(AUTH_ERROR.ADMIN_EMAIL_TAKEN);

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );

    const admin = await this.prisma.admin.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? '',
        password: hashedPassword,
        role: dto.role ?? AdminRole.ADMIN,
        permissions: dto.permissions ?? [],
        isActive: true,
        createdBy,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.logger.log(`Admin created: ${admin.email} by ${createdBy}`);
    return admin;
  }

  async listAdmins(callerRole: AdminRole) {
    this.requireSuperAdmin(callerRole);

    return this.prisma.admin.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        permissions: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdmin(targetId: string, callerRole: AdminRole) {
    this.requireSuperAdmin(callerRole);
    return this.findActiveAdminOrFail(targetId);
  }

  async updatePermissions(
    targetId: string,
    dto: UpdateAdminPermissionsDto,
    callerRole: AdminRole,
  ) {
    this.requireSuperAdmin(callerRole);

    if (!dto.add && !dto.remove && !dto.set) {
      throw new BadRequestException(
        'Provide at least one of: add, remove, or set',
      );
    }

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(
      target.role,
      'Cannot modify SUPERADMIN permissions',
    );

    let updatedPermissions: AdminPermission[];

    if (dto.set) {
      updatedPermissions = dto.set;
    } else {
      const current = new Set<AdminPermission>(target.permissions);
      dto.add?.forEach((p) => current.add(p));
      dto.remove?.forEach((p) => current.delete(p));
      updatedPermissions = Array.from(current);
    }

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { permissions: updatedPermissions },
    });

    this.logger.log(`Permissions updated for admin ${targetId}`);
    return { permissions: updatedPermissions };
  }

  async updateRole(
    targetId: string,
    dto: UpdateAdminRoleDto,
    callerRole: AdminRole,
  ) {
    this.requireSuperAdmin(callerRole);

    if (dto.role === AdminRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot promote to SUPERADMIN');
    }

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(target.role, 'Cannot change SUPERADMIN role');

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { role: dto.role },
    });

    this.logger.log(`Role updated for admin ${targetId} → ${dto.role}`);
  }

  async enableAdmin(targetId: string, callerRole: AdminRole, callerId: string) {
    this.requireSuperAdmin(callerRole);
    this.preventSelfModify(targetId, callerId, 'Cannot modify your own status');

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(
      target.role,
      'Cannot enable/disable SUPERADMIN',
    );

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { isActive: true },
    });
  }

  async disableAdmin(
    targetId: string,
    callerRole: AdminRole,
    callerId: string,
  ) {
    this.requireSuperAdmin(callerRole);
    this.preventSelfModify(targetId, callerId, 'Cannot modify your own status');

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(
      target.role,
      'Cannot enable/disable SUPERADMIN',
    );

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { isActive: false },
    });

    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );
    this.logger.log(`Admin ${targetId} disabled by ${callerId}`);
  }

  async unlockAdmin(targetId: string, callerRole: AdminRole) {
    this.requireSuperAdmin(callerRole);
    await this.findActiveAdminOrFail(targetId);

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    this.logger.log(`Admin ${targetId} unlocked`);
  }

  async resetAdminPassword(
    targetId: string,
    newPassword: string,
    callerRole: AdminRole,
  ) {
    this.requireSuperAdmin(callerRole);
    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(
      target.role,
      'Cannot reset SUPERADMIN password',
    );

    const hashed = await bcrypt.hash(newPassword, AUTH_CONFIG.BCRYPT_ROUNDS);
    await this.prisma.admin.update({
      where: { id: targetId },
      data: { password: hashed },
    });

    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );
    this.logger.log(`Password force-reset for admin ${targetId}`);
  }

  async deleteAdmin(targetId: string, callerRole: AdminRole, callerId: string) {
    this.requireSuperAdmin(callerRole);
    this.preventSelfModify(targetId, callerId, 'Cannot delete yourself');

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(target.role, 'Cannot delete SUPERADMIN');

    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );
    await this.prisma.softDelete('admin', targetId, callerId);
    this.logger.log(`Admin ${targetId} soft-deleted by ${callerId}`);
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT — ADMIN OPERATIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * List all registered (non-guest) customers with filters + pagination
   */
  async listCustomers(dto: ListCustomersDto) {
    const skip = (dto.page - 1) * dto.limit;

    const where: any = {
      deletedAt: null,
      isGuest: false,
    };

    if (dto.search) {
      where.OR = [
        { phone: { contains: dto.search } },
        { email: { contains: dto.search, mode: 'insensitive' } },
        { firstName: { contains: dto.search, mode: 'insensitive' } },
        { lastName: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.isActive !== undefined) where.isActive = dto.isActive;
    if (dto.isGuest !== undefined) where.isGuest = dto.isGuest;

    if (dto.fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(dto.fromDate) };
    }
    if (dto.toDate) {
      const to = new Date(dto.toDate);
      to.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: to };
    }

    const orderBy: any = {};
    if (dto.sortBy === 'orderCount') {
      // Can't directly sort by relation count — use createdAt fallback
      orderBy.createdAt = dto.sortOrder ?? 'desc';
    } else {
      orderBy[dto.sortBy ?? 'createdAt'] = dto.sortOrder ?? 'desc';
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: dto.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          emailVerified: true,
          phoneVerified: true,
          isGuest: true,
          isActive: true,
          avatar: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { orders: true, addresses: true, reviews: true },
          },
          tags: {
            select: { label: true, color: true },
          },
        },
        orderBy,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map((c) => ({
        ...c,
        orderCount: c._count.orders,
        addressCount: c._count.addresses,
        reviewCount: c._count.reviews,
        _count: undefined,
      })),
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

  /**
   * List guest customers (placed orders without registering)
   */
  async listGuestCustomers(dto: ListGuestCustomersDto) {
    const skip = (dto.page - 1) * dto.limit;

    const where: any = {
      deletedAt: null,
      isGuest: true,
    };

    if (dto.search) {
      where.OR = [
        { phone: { contains: dto.search } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: dto.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          phoneVerified: true,
          isGuest: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: dto.sortOrder ?? 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers.map((c) => ({
        ...c,
        orderCount: c._count.orders,
        _count: undefined,
      })),
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

  /**
   * Get full customer profile with all related data
   */
  async getCustomerById(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        emailVerified: true,
        phoneVerified: true,
        isGuest: true,
        isActive: true,
        avatar: true,
        lastLoginAt: true,
        lastLoginIp: true,
        loginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          where: { deletedAt: null },
          select: {
            id: true,
            label: true,
            fullName: true,
            phone: true,
            addressLine: true,
            postalCode: true,
            isDefault: true,
            division: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
            area: { select: { id: true, name: true } },
          },
          orderBy: { isDefault: 'desc' },
        },
        tags: {
          select: { id: true, label: true, color: true, createdAt: true },
        },
        notes: {
          where: { deletedAt: null },
          select: {
            id: true,
            note: true,
            isPinned: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        },
        wallet: {
          select: {
            id: true,
            balance: true,
            currency: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
            addresses: true,
            couponUsages: true,
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return {
      ...customer,
      stats: {
        orderCount: customer._count.orders,
        reviewCount: customer._count.reviews,
        addressCount: customer._count.addresses,
        couponUsageCount: customer._count.couponUsages,
      },
      _count: undefined,
    };
  }

  /**
   * Update customer profile (admin override)
   */
  async updateCustomer(
    customerId: string,
    dto: AdminUpdateCustomerDto,
    adminId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Email uniqueness check
    if (dto.email && dto.email !== customer.email) {
      const emailTaken = await this.prisma.customer.findFirst({
        where: { email: dto.email, id: { not: customerId }, deletedAt: null },
        select: { id: true },
      });
      if (emailTaken)
        throw new ConflictException('Email address already in use');
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && {
          email: dto.email,
          emailVerified: false,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        emailVerified: true,
        isGuest: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Admin ${adminId} updated customer ${customerId}`);
    return updated;
  }

  /**
   * Force reset customer password
   */
  async resetCustomerPassword(
    customerId: string,
    dto: AdminResetCustomerPasswordDto,
    adminId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, isGuest: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.isGuest) {
      throw new BadRequestException(
        'Cannot set password for guest account. Customer must upgrade first.',
      );
    }

    const hashed = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONFIG.BCRYPT_ROUNDS,
    );
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { password: hashed },
    });

    // Force re-login
    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(
      `Admin ${adminId} force-reset password for customer ${customerId}`,
    );
  }

  /**
   * Activate customer account
   */
  async activateCustomer(customerId: string, adminId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { isActive: true },
    });
    this.logger.log(`Admin ${adminId} activated customer ${customerId}`);
  }

  /**
   * Deactivate customer account + revoke sessions
   */
  async deactivateCustomer(customerId: string, adminId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { isActive: false },
    });

    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    this.logger.log(`Admin ${adminId} deactivated customer ${customerId}`);
  }

  /**
   * Unlock locked customer account (reset login attempts)
   */
  async unlockCustomer(customerId: string, adminId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    this.logger.log(`Admin ${adminId} unlocked customer ${customerId}`);
  }

  /**
   * Soft-delete customer account
   */
  async deleteCustomer(customerId: string, adminId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.tokenService.revokeAllOwnerTokens(
      'CUSTOMER',
      customerId,
      'All_DEVICES',
    );
    await this.prisma.softDelete('customer', customerId, adminId);
    this.logger.log(`Admin ${adminId} deleted customer ${customerId}`);
  }

  /**
   * Bulk action on customers
   */
  async bulkCustomerAction(dto: BulkCustomerActionDto, adminId: string) {
    if (!dto.customerIds.length) {
      throw new BadRequestException('No customer IDs provided');
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const customerId of dto.customerIds) {
      try {
        switch (dto.action) {
          case 'activate':
            await this.activateCustomer(customerId, adminId);
            break;
          case 'deactivate':
            await this.deactivateCustomer(customerId, adminId);
            break;
          case 'delete':
            await this.deleteCustomer(customerId, adminId);
            break;
          default:
            throw new BadRequestException(`Unknown action: ${dto.action}`);
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${customerId}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Admin ${adminId} bulk ${dto.action}: ${results.success} succeeded, ${results.failed} failed`,
    );
    return results;
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER NOTES
  // ══════════════════════════════════════════════════════════════

  async getCustomerNotes(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customerNote.findMany({
      where: { customerId, deletedAt: null },
      select: {
        id: true,
        note: true,
        isPinned: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createCustomerNote(
    customerId: string,
    dto: CreateCustomerNoteDto,
    adminId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customerNote.create({
      data: {
        customerId,
        note: dto.note,
        isPinned: dto.isPinned ?? false,
        createdBy: adminId,
      },
      select: {
        id: true,
        note: true,
        isPinned: true,
        createdBy: true,
        createdAt: true,
      },
    });
  }

  async updateCustomerNote(
    customerId: string,
    noteId: string,
    dto: UpdateCustomerNoteDto,
    adminId: string,
  ) {
    const note = await this.prisma.customerNote.findFirst({
      where: { id: noteId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found');

    return this.prisma.customerNote.update({
      where: { id: noteId },
      data: {
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      select: {
        id: true,
        note: true,
        isPinned: true,
        createdBy: true,
        updatedAt: true,
      },
    });
  }

  async deleteCustomerNote(
    customerId: string,
    noteId: string,
    adminId: string,
  ): Promise<void> {
    const note = await this.prisma.customerNote.findFirst({
      where: { id: noteId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found');

    await this.prisma.softDelete('customerNote', noteId, adminId);
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER TAGS
  // ══════════════════════════════════════════════════════════════

  async getCustomerTags(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customerTag.findMany({
      where: { customerId },
      select: { id: true, label: true, color: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCustomerTag(
    customerId: string,
    dto: CreateCustomerTagDto,
    adminId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Check max tags per customer (10)
    const tagCount = await this.prisma.customerTag.count({
      where: { customerId },
    });
    if (tagCount >= 10) {
      throw new BadRequestException('Maximum 10 tags per customer');
    }

    try {
      return await this.prisma.customerTag.create({
        data: {
          customerId,
          label: dto.label,
          color: dto.color,
          createdBy: adminId,
        },
        select: { id: true, label: true, color: true, createdAt: true },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          `Tag "${dto.label}" already exists for this customer`,
        );
      }
      throw err;
    }
  }

  async removeCustomerTag(
    customerId: string,
    tagId: string,
    adminId: string,
  ): Promise<void> {
    const tag = await this.prisma.customerTag.findFirst({
      where: { id: tagId, customerId },
      select: { id: true },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.customerTag.delete({ where: { id: tagId } });
    this.logger.log(
      `Admin ${adminId} removed tag ${tagId} from customer ${customerId}`,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER ORDERS (READ-ONLY VIEW)
  // ══════════════════════════════════════════════════════════════

  async getCustomerOrders(customerId: string, page = 1, limit = 20) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId, deletedAt: null },
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
          couponCode: true,
          createdAt: true,
          deliveredAt: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { customerId, deletedAt: null } }),
    ]);

    return {
      data: orders.map((o) => ({
        ...o,
        itemCount: o._count.products,
        _count: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CUSTOMER WALLET (READ-ONLY VIEW)
  // ══════════════════════════════════════════════════════════════

  async getCustomerWallet(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
      select: {
        id: true,
        balance: true,
        currency: true,
        isActive: true,
        createdAt: true,
        transactions: {
          select: {
            id: true,
            type: true,
            amount: true,
            balance: true,
            orderId: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!wallet) {
      return { message: 'No wallet found for this customer', data: null };
    }

    return wallet;
  }

  // ══════════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ══════════════════════════════════════════════════════════════

  async getDashboardStats(dto: DashboardQueryDto) {
    const rangeMs: Record<string, number> = {
      '1d': 86400000,
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
      '1y': 365 * 86400000,
    };

    const from = new Date(
      Date.now() - (rangeMs[dto.range ?? '7d'] ?? rangeMs['7d']),
    );

    const [
      totalCustomers,
      newCustomers,
      guestCustomers,
      activeCustomers,
      totalOrders,
      newOrders,
      revenueResult,
      pendingOrders,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { deletedAt: null, isGuest: false },
      }),
      this.prisma.customer.count({
        where: { deletedAt: null, isGuest: false, createdAt: { gte: from } },
      }),
      this.prisma.customer.count({ where: { deletedAt: null, isGuest: true } }),
      this.prisma.customer.count({
        where: { deletedAt: null, isGuest: false, isActive: true },
      }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.order.count({
        where: { deletedAt: null, createdAt: { gte: from } },
      }),
      this.prisma.order.aggregate({
        where: { deletedAt: null, createdAt: { gte: from } },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { deletedAt: null, status: 'PENDING' },
      }),
    ]);

    return {
      range: dto.range ?? '7d',
      from,
      customers: {
        total: totalCustomers,
        new: newCustomers,
        guests: guestCustomers,
        active: activeCustomers,
      },
      orders: {
        total: totalOrders,
        new: newOrders,
        pending: pendingOrders,
        revenue: revenueResult._sum.total ?? 0,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE GUARDS
  // ══════════════════════════════════════════════════════════════

  private requireSuperAdmin(role: AdminRole): void {
    if (role !== AdminRole.SUPERADMIN) {
      throw new ForbiddenException(AUTH_ERROR.ADMIN_INSUFFICIENT_ROLE);
    }
  }

  private preventSelfModify(
    targetId: string,
    callerId: string,
    message: string,
  ): void {
    if (targetId === callerId) throw new BadRequestException(message);
  }

  private preventModifySuperAdmin(
    targetRole: AdminRole,
    message: string,
  ): void {
    if (targetRole === AdminRole.SUPERADMIN)
      throw new ForbiddenException(message);
  }

  private async findActiveAdminOrFail(adminId: string) {
    const admin = await this.prisma.admin.findFirst({
      where: { id: adminId, deletedAt: null },
      select: { id: true, role: true, permissions: true, isActive: true },
    });
    if (!admin) throw new NotFoundException(AUTH_ERROR.ADMIN_NOT_FOUND);
    return admin;
  }
}
