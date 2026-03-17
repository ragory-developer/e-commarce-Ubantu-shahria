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
  // ADMIN MANAGEMENT (SUPERADMIN operations)
  // ══════════════════════════════════════════════════════════════

  // ─── Create Admin ─────────────────────────────────────────────
  async createAdmin(
    dto: CreateAdminDto,
    callerRole: AdminRole,
    createdBy: string,
  ): Promise<object> {
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
        phone: dto.phone ?? null,
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
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.logger.log(`Admin created: ${admin.email} by ${createdBy}`);
    return admin;
  }

  // ─── List Admins ──────────────────────────────────────────────
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

  // ─── Get single admin (SUPERADMIN view) ───────────────────────
  async getAdmin(targetId: string, callerRole: AdminRole) {
    this.requireSuperAdmin(callerRole);
    return this.findActiveAdminOrFail(targetId);
  }

  // ─── Update Permissions ───────────────────────────────────────
  async updatePermissions(
    targetId: string,
    dto: UpdateAdminPermissionsDto,
    callerRole: AdminRole,
  ): Promise<{ permissions: AdminPermission[] }> {
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

  // ─── Update Role ──────────────────────────────────────────────
  async updateRole(
    targetId: string,
    dto: UpdateAdminRoleDto,
    callerRole: AdminRole,
  ): Promise<void> {
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

  // ─── Enable Admin ──────────────────────────────────────────────
  async enableAdmin(
    targetId: string,
    callerRole: AdminRole,
    callerId: string,
  ): Promise<void> {
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

  // ─── Disable Admin ─────────────────────────────────────────────
  async disableAdmin(
    targetId: string,
    callerRole: AdminRole,
    callerId: string,
  ): Promise<void> {
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

    // Revoke all sessions
    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );
    this.logger.log(`Admin ${targetId} disabled by ${callerId}`);
  }

  // ─── Unlock Admin (reset login attempts) ──────────────────────
  async unlockAdmin(targetId: string, callerRole: AdminRole): Promise<void> {
    this.requireSuperAdmin(callerRole);
    await this.findActiveAdminOrFail(targetId);

    await this.prisma.admin.update({
      where: { id: targetId },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    this.logger.log(`Admin ${targetId} unlocked`);
  }

  // ─── Reset Admin Password (SUPERADMIN forced reset) ──────────
  async resetAdminPassword(
    targetId: string,
    newPassword: string,
    callerRole: AdminRole,
  ): Promise<void> {
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

    // Force re-login
    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );
    this.logger.log(`Password reset for admin ${targetId}`);
  }

  // ─── Soft Delete Admin ─────────────────────────────────────────
  async deleteAdmin(
    targetId: string,
    callerRole: AdminRole,
    callerId: string,
  ): Promise<void> {
    this.requireSuperAdmin(callerRole);
    this.preventSelfModify(targetId, callerId, 'Cannot delete yourself');

    const target = await this.findActiveAdminOrFail(targetId);
    this.preventModifySuperAdmin(target.role, 'Cannot delete SUPERADMIN');

    // Revoke all tokens first
    await this.tokenService.revokeAllOwnerTokens(
      'ADMIN',
      targetId,
      'All_DEVICES',
    );

    await this.prisma.softDelete('admin', targetId, callerId);
    this.logger.log(`Admin ${targetId} soft-deleted by ${callerId}`);
  }

  // ══════════════════════════════════════════════════════════════
  // OWN PROFILE (any authenticated admin)
  // ══════════════════════════════════════════════════════════════

  // ─── Get own profile ──────────────────────────────────────────
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
        createdAt: true,
      },
    });
    if (!admin) throw new NotFoundException(AUTH_ERROR.ADMIN_NOT_FOUND);
    return admin;
  }

  // ─── Update own profile ───────────────────────────────────────
  async updateProfile(
    adminId: string,
    dto: UpdateAdminProfileDto,
  ): Promise<object> {
    await this.getProfile(adminId); // ensure exists

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
      },
    });
  }

  // ─── Change own password ──────────────────────────────────────
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
