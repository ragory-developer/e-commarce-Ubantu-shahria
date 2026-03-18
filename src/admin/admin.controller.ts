// ─── src/admin/admin.controller.ts ───────────────────────────
// Production-ready admin controller with full customer management

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
  ApiQuery,
  ApiResponse,
  ApiBody,
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
  AdminResetPasswordDto,
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

// ──────────────────────────────────────────────────────────────
// RE-EXPORT AdminResetPasswordDto from admin-change-password.dto
// ──────────────────────────────────────────────────────────────

@ApiTags('Admin — Management')
@ApiBearerAuth('access-token')
@UserType('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ════════════════════════════════════════════════════════════
  // OWN PROFILE — any authenticated admin
  // ════════════════════════════════════════════════════════════

  @Get('profile')
  @ApiOperation({ summary: 'Get own admin profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved',
    schema: {
      example: {
        message: 'Profile retrieved',
        data: {
          id: 'clx1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+8801700000000',
          avatar: null,
          role: 'ADMIN',
          permissions: ['PRODUCT_READ', 'ORDER_READ'],
          isActive: true,
          lastLoginAt: '2024-03-17T10:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async getOwnProfile(@CurrentUser() user: RequestUser) {
    const data = await this.adminService.getProfile(user.id);
    return { message: 'Profile retrieved', data };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own profile (name, phone, avatar)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateOwnProfile(
    @Body() dto: UpdateAdminProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.updateProfile(user.id, dto);
    return { message: 'Profile updated', data };
  }

  @Post('profile/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  @ApiResponse({
    status: 200,
    description: 'Password changed. All sessions revoked.',
  })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changeOwnPassword(
    @Body() dto: AdminChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.changePassword(user.id, dto);
    return { message: 'Password changed. Please login again.', data: null };
  }

  // ════════════════════════════════════════════════════════════
  // ADMIN MANAGEMENT — SUPERADMIN ONLY
  // ════════════════════════════════════════════════════════════

  @Post('manage')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: '[SUPERADMIN] Create a new admin account' })
  @ApiResponse({ status: 201, description: 'Admin created successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 403, description: 'Cannot create SUPERADMIN' })
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
  @ApiResponse({ status: 200, description: 'Admins retrieved' })
  async listAdmins(@CurrentUser() user: RequestUser) {
    const data = await this.adminService.listAdmins(user.role!);
    return { message: 'Admins retrieved', data };
  }

  @Get('manage/:id')
  @Roles(AdminRole.SUPERADMIN)
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({ summary: '[SUPERADMIN] Get a specific admin' })
  @ApiResponse({ status: 200, description: 'Admin retrieved' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
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
  @ApiResponse({ status: 200, description: 'Permissions updated' })
  @ApiResponse({
    status: 403,
    description: 'Cannot modify SUPERADMIN permissions',
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
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Cannot promote to SUPERADMIN' })
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
  @ApiResponse({ status: 200, description: 'Admin enabled' })
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
  @ApiResponse({ status: 200, description: 'Admin disabled' })
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
  @ApiResponse({ status: 200, description: 'Admin account unlocked' })
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
  @ApiResponse({ status: 200, description: 'Admin password reset' })
  async resetAdminPassword(
    @Param('id') id: string,
    @Body() body: AdminResetPasswordDto,
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
  @ApiResponse({ status: 200, description: 'Admin deleted' })
  async deleteAdmin(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.adminService.deleteAdmin(id, user.role!, user.id);
    return { message: 'Admin deleted', data: null };
  }

  // ════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Returns key metrics: customers, orders, revenue for the selected time range.',
  })
  @ApiQuery({
    name: 'range',
    enum: ['1d', '7d', '30d', '90d', '1y'],
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats',
    schema: {
      example: {
        message: 'Dashboard stats retrieved',
        data: {
          range: '7d',
          customers: { total: 1500, new: 45, guests: 320, active: 1180 },
          orders: { total: 4200, new: 180, pending: 23, revenue: 1250000 },
        },
      },
    },
  })
  async getDashboardStats(@Query() dto: DashboardQueryDto) {
    const data = await this.adminService.getDashboardStats(dto);
    return { message: 'Dashboard stats retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT
  // ════════════════════════════════════════════════════════════

  @Get('customers')
  @Permissions('ORDER_READ')
  @ApiOperation({
    summary: 'List registered customers with filters & pagination',
    description:
      'Returns paginated registered (non-guest) customers. ' +
      'Filter by active status, date range, search by phone/email/name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Customers retrieved',
    schema: {
      example: {
        message: 'Customers retrieved',
        data: {
          data: [
            {
              id: 'clx1',
              firstName: 'John',
              lastName: 'Doe',
              phone: '01712345678',
              email: 'john@example.com',
              isActive: true,
              isGuest: false,
              orderCount: 5,
              tags: [{ label: 'VIP', color: 'GREEN' }],
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          meta: {
            total: 1500,
            page: 1,
            limit: 20,
            totalPages: 75,
            hasNextPage: true,
            hasPrevPage: false,
          },
        },
      },
    },
  })
  async listCustomers(@Query() dto: ListCustomersDto) {
    const data = await this.adminService.listCustomers(dto);
    return { message: 'Customers retrieved', data };
  }

  @Get('customers/guests')
  @Permissions('ORDER_READ')
  @ApiOperation({
    summary: 'List guest customers',
    description:
      'Returns paginated guest customers who ordered without registering.',
  })
  @ApiResponse({ status: 200, description: 'Guest customers retrieved' })
  async listGuestCustomers(@Query() dto: ListGuestCustomersDto) {
    const data = await this.adminService.listGuestCustomers(dto);
    return { message: 'Guest customers retrieved', data };
  }

  @Get('customers/:id')
  @Permissions('ORDER_READ')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Get full customer profile',
    description:
      'Returns complete customer profile including addresses, tags, notes, wallet, and stats.',
  })
  @ApiResponse({ status: 200, description: 'Customer retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomer(@Param('id') id: string) {
    const data = await this.adminService.getCustomerById(id);
    return { message: 'Customer retrieved', data };
  }

  @Patch('customers/:id')
  @Permissions('ORDER_UPDATE_STATUS')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Update customer profile (admin override)',
    description:
      'Admin can update name, email, active status. Phone cannot be changed.',
  })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateCustomer(
    @Param('id') id: string,
    @Body() dto: AdminUpdateCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.updateCustomer(id, dto, user.id);
    return { message: 'Customer updated', data };
  }

  @Patch('customers/:id/activate')
  @Permissions('ORDER_UPDATE_STATUS')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({ summary: 'Activate customer account' })
  @ApiResponse({ status: 200, description: 'Customer activated' })
  async activateCustomer(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.activateCustomer(id, user.id);
    return { message: 'Customer activated', data: null };
  }

  @Patch('customers/:id/deactivate')
  @Permissions('ORDER_UPDATE_STATUS')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Deactivate customer account + revoke all sessions',
  })
  @ApiResponse({ status: 200, description: 'Customer deactivated' })
  async deactivateCustomer(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.deactivateCustomer(id, user.id);
    return { message: 'Customer deactivated', data: null };
  }

  @Patch('customers/:id/unlock')
  @Permissions('ORDER_UPDATE_STATUS')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Unlock locked customer account (reset login attempts)',
  })
  @ApiResponse({ status: 200, description: 'Customer account unlocked' })
  async unlockCustomer(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.unlockCustomer(id, user.id);
    return { message: 'Customer account unlocked', data: null };
  }

  @Patch('customers/:id/reset-password')
  @Permissions('ADMIN_EDIT')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Force-reset customer password + revoke all sessions',
    description: 'Only works on registered (non-guest) accounts.',
  })
  @ApiResponse({ status: 200, description: 'Customer password reset' })
  @ApiResponse({
    status: 400,
    description: 'Cannot set password for guest account',
  })
  async resetCustomerPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetCustomerPasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.resetCustomerPassword(id, dto, user.id);
    return { message: 'Customer password reset successfully', data: null };
  }

  @Delete('customers/:id')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: '[SUPERADMIN] Soft-delete customer account + revoke all sessions',
  })
  @ApiResponse({ status: 200, description: 'Customer deleted' })
  async deleteCustomer(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.deleteCustomer(id, user.id);
    return { message: 'Customer deleted', data: null };
  }

  @Post('customers/bulk-action')
  @Roles(AdminRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      '[SUPERADMIN] Bulk action on customers (activate/deactivate/delete)',
    description:
      'Performs an action on multiple customers. Returns success/fail counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk action result',
    schema: {
      example: {
        message: 'Bulk action completed',
        data: { success: 8, failed: 2, errors: ['clxabc: Customer not found'] },
      },
    },
  })
  async bulkCustomerAction(
    @Body() dto: BulkCustomerActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.bulkCustomerAction(dto, user.id);
    return { message: 'Bulk action completed', data };
  }

  // ════════════════════════════════════════════════════════════
  // CUSTOMER ORDERS (read-only)
  // ════════════════════════════════════════════════════════════

  @Get('customers/:id/orders')
  @Permissions('ORDER_READ')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'View customer order history' })
  @ApiResponse({ status: 200, description: 'Customer orders retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomerOrders(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const data = await this.adminService.getCustomerOrders(
      id,
      Number(page),
      Number(limit),
    );
    return { message: 'Customer orders retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // CUSTOMER WALLET (read-only)
  // ════════════════════════════════════════════════════════════

  @Get('customers/:id/wallet')
  @Permissions('FINANCE_VIEW')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({ summary: 'View customer wallet + recent transactions' })
  @ApiResponse({ status: 200, description: 'Customer wallet retrieved' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getCustomerWallet(@Param('id') id: string) {
    const data = await this.adminService.getCustomerWallet(id);
    return { message: 'Customer wallet retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // CUSTOMER NOTES
  // ════════════════════════════════════════════════════════════

  @Get('customers/:id/notes')
  @Permissions('ORDER_READ')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({ summary: 'List all notes for a customer (pinned first)' })
  @ApiResponse({ status: 200, description: 'Notes retrieved' })
  async getCustomerNotes(@Param('id') id: string) {
    const data = await this.adminService.getCustomerNotes(id);
    return { message: 'Notes retrieved', data };
  }

  @Post('customers/:id/notes')
  @Permissions('ORDER_UPDATE_STATUS')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({ summary: 'Add a note to a customer' })
  @ApiResponse({ status: 201, description: 'Note added' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async createCustomerNote(
    @Param('id') id: string,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.createCustomerNote(id, dto, user.id);
    return { message: 'Note added', data };
  }

  @Patch('customers/:id/notes/:noteId')
  @Permissions('ORDER_UPDATE_STATUS')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiOperation({ summary: 'Update a customer note (content or pin status)' })
  @ApiResponse({ status: 200, description: 'Note updated' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async updateCustomerNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateCustomerNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.updateCustomerNote(
      id,
      noteId,
      dto,
      user.id,
    );
    return { message: 'Note updated', data };
  }

  @Delete('customers/:id/notes/:noteId')
  @Permissions('ORDER_UPDATE_STATUS')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiOperation({ summary: 'Delete a customer note (soft delete)' })
  @ApiResponse({ status: 200, description: 'Note deleted' })
  async deleteCustomerNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.deleteCustomerNote(id, noteId, user.id);
    return { message: 'Note deleted', data: null };
  }

  // ════════════════════════════════════════════════════════════
  // CUSTOMER TAGS
  // ════════════════════════════════════════════════════════════

  @Get('customers/:id/tags')
  @Permissions('ORDER_READ')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({ summary: 'List all tags for a customer' })
  @ApiResponse({ status: 200, description: 'Tags retrieved' })
  async getCustomerTags(@Param('id') id: string) {
    const data = await this.adminService.getCustomerTags(id);
    return { message: 'Tags retrieved', data };
  }

  @Post('customers/:id/tags')
  @Permissions('ORDER_UPDATE_STATUS')
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiOperation({
    summary: 'Add a tag to a customer',
    description:
      'Maximum 10 tags per customer. Label must be unique per customer.',
  })
  @ApiResponse({ status: 201, description: 'Tag added' })
  @ApiResponse({
    status: 409,
    description: 'Tag label already exists for this customer',
  })
  @ApiResponse({ status: 400, description: 'Maximum 10 tags per customer' })
  async addCustomerTag(
    @Param('id') id: string,
    @Body() dto: CreateCustomerTagDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.adminService.addCustomerTag(id, dto, user.id);
    return { message: 'Tag added', data };
  }

  @Delete('customers/:id/tags/:tagId')
  @Permissions('ORDER_UPDATE_STATUS')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID' })
  @ApiOperation({ summary: 'Remove a tag from a customer' })
  @ApiResponse({ status: 200, description: 'Tag removed' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async removeCustomerTag(
    @Param('id') id: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.adminService.removeCustomerTag(id, tagId, user.id);
    return { message: 'Tag removed', data: null };
  }
}
