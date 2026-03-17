import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestUser } from '../auth/auth.types';
import {
  CreateAdminDto,
  UpdateAdminPermissionsDto,
  UpdateAdminRoleDto,
  UpdateAdminProfileDto,
  AdminChangePasswordDto,
} from './dto';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ResetPasswordBodyDto {
  @ApiProperty({ example: 'TempP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

@ApiTags('Admin — Management')
@ApiBearerAuth('access-token')
@UserType('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ══════════════════════════════════════════════════════════════
  // OWN PROFILE (any authenticated admin)
  // ══════════════════════════════════════════════════════════════

  @Get('profile')
  @ApiOperation({ summary: 'Get own admin profile' })
  async getOwnProfile(@CurrentUser() user: RequestUser) {
    const data = await this.adminService.getProfile(user.id);
    return { message: 'Profile retrieved', data };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile (name, phone, avatar)' })
  async updateOwnProfile(
    @Body() dto: UpdateAdminProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.updateProfile(user.id, dto);
    return { message: 'Profile updated', data };
  }

  @Post('profile/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password' })
  async changeOwnPassword(
    @Body() dto: AdminChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.changePassword(user.id, dto);
    return { message: 'Password changed. Please login again.', data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // ADMIN MANAGEMENT — SUPERADMIN ONLY
  // ══════════════════════════════════════════════════════════════

  @Post('manage')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] Create a new admin account' })
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.createAdmin(dto, user.role!, user.id);
    return { message: 'Admin created successfully', data };
  }

  @Get('manage')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] List all admins' })
  async listAdmins(@CurrentUser() user: RequestUser) {
    const data = await this.adminService.listAdmins(user.role!);
    return { message: 'Admins retrieved', data };
  }

  @Get('manage/:id')
  @Roles(AdminRole.SUPERADMIN)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({ summary: '[SUPERADMIN] Get a specific admin' })
  async getAdmin(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.adminService.getAdmin(id, user.role!);
    return { message: 'Admin retrieved', data };
  }

  @Patch('manage/:id/permissions')
  @Roles(AdminRole.SUPERADMIN)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Update admin permissions (add / remove / set)',
    description:
      'Use `add` to grant permissions, `remove` to revoke, or `set` to replace all at once.',
  })
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.updatePermissions(id, dto, user.role!);
    return { message: 'Permissions updated', data };
  }

  @Patch('manage/:id/role')
  @Roles(AdminRole.SUPERADMIN)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({ summary: '[SUPERADMIN] Change admin role (ADMIN / MANAGER)' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateAdminRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.updateRole(id, dto, user.role!);
    return { message: 'Role updated', data: null };
  }

  @Patch('manage/:id/enable')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({ summary: '[SUPERADMIN] Enable a disabled admin account' })
  async enableAdmin(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.adminService.enableAdmin(id, user.role!, user.id);
    return { message: 'Admin enabled', data: null };
  }

  @Patch('manage/:id/disable')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Disable admin account + revoke all sessions',
  })
  async disableAdmin(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.disableAdmin(id, user.role!, user.id);
    return { message: 'Admin disabled', data: null };
  }

  @Patch('manage/:id/unlock')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Unlock admin account (reset failed login attempts)',
  })
  async unlockAdmin(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.adminService.unlockAdmin(id, user.role!);
    return { message: 'Admin account unlocked', data: null };
  }

  @Patch('manage/:id/reset-password')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Force-reset admin password + revoke all sessions',
  })
  async resetAdminPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.resetAdminPassword(
      id,
      body.newPassword,
      user.role!,
    );
    return { message: 'Admin password reset successfully', data: null };
  }

  @Delete('manage/:id')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Soft-delete admin account + revoke all sessions',
  })
  async deleteAdmin(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.adminService.deleteAdmin(id, user.role!, user.id);
    return { message: 'Admin deleted', data: null };
  }
}
