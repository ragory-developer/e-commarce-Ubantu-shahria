// ─── src/customer/customer.controller.ts ─────────────────────
// Production-ready customer controller

import {
  Controller,
  Get,
  Patch,
  Post,
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
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import {
  UpdateCustomerProfileDto,
  ChangePasswordDto,
  UpgradeGuestDto,
  CustomerOrdersQueryDto,
  CustomerWalletQueryDto,
} from './dto';

@ApiTags('Customer — Account')
@ApiBearerAuth('access-token')
@UserType('CUSTOMER')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ════════════════════════════════════════════════════════════
  // ACCOUNT SUMMARY
  // ════════════════════════════════════════════════════════════

  @Get('account/summary')
  @ApiOperation({
    summary: 'Get account summary (dashboard)',
    description:
      'Returns profile, wallet balance, and order/address/review counts in one call.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account summary retrieved',
    schema: {
      example: {
        message: 'Account summary retrieved',
        data: {
          profile: {
            id: 'clx1',
            firstName: 'John',
            phone: '01712345678',
            phoneVerified: true,
            email: 'john@example.com',
            emailVerified: false,
            isGuest: false,
            isActive: true,
            avatar: null,
            lastLoginAt: '2024-03-17T10:00:00.000Z',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          wallet: { balance: '150.00', currency: 'BDT' },
          stats: {
            totalOrders: 12,
            activeOrders: 2,
            addresses: 3,
            reviews: 5,
          },
        },
      },
    },
  })
  async getAccountSummary(@CurrentUser() user: RequestUser) {
    const data = await this.customerService.getAccountSummary(user.id);
    return { message: 'Account summary retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════════════════════════

  @Get('profile')
  @ApiOperation({
    summary: 'Get my full profile',
    description: 'Returns profile with wallet balance and counts.',
  })
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
          phone: '01712345678',
          phoneVerified: true,
          email: 'john@example.com',
          emailVerified: false,
          isGuest: false,
          isActive: true,
          avatar: null,
          wallet: { balance: '150.00', currency: 'BDT', isActive: true },
          stats: { orderCount: 12, addressCount: 3, reviewCount: 5 },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async getProfile(@CurrentUser() user: RequestUser) {
    const data = await this.customerService.getProfile(user.id);
    return { message: 'Profile retrieved', data };
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update my profile (name, email, avatar)',
    description:
      'Phone number CANNOT be changed — it is the primary identifier. ' +
      'Updating email resets emailVerified to false.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateProfile(
    @Body() dto: UpdateCustomerProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.updateProfile(user.id, dto);
    return { message: 'Profile updated', data };
  }

  // ════════════════════════════════════════════════════════════
  // PASSWORD
  // ════════════════════════════════════════════════════════════

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change my password',
    description:
      'Requires current password. All sessions will be revoked after change. ' +
      'Only available for registered (non-guest) accounts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed. All sessions revoked.',
  })
  @ApiResponse({ status: 400, description: 'No password set (guest account)' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.customerService.changePassword(user.id, dto);
    return {
      message: 'Password changed successfully. Please login again.',
      data: null,
    };
  }

  // ════════════════════════════════════════════════════════════
  // UPGRADE GUEST
  // ════════════════════════════════════════════════════════════

  @Post('upgrade-to-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade guest account to full registered account',
    description:
      'Phone must be verified first via POST /auth/customer/verify-phone/request. ' +
      'Sets a password and upgrades guest → registered. ' +
      'Same customer ID is kept — all orders are preserved.',
  })
  @ApiResponse({ status: 200, description: 'Account upgraded successfully' })
  @ApiResponse({ status: 400, description: 'Account is already registered' })
  @ApiResponse({ status: 403, description: 'Phone not verified' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async upgradeGuest(
    @Body() dto: UpgradeGuestDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.upgradeGuest(user.id, dto);
    return { message: 'Account upgraded successfully', data };
  }

  // ════════════════════════════════════════════════════════════
  // ACCOUNT MANAGEMENT
  // ════════════════════════════════════════════════════════════

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate my account',
    description:
      'Soft-deactivates account and revokes all sessions. ' +
      'Account data is preserved. Admin can reactivate.',
  })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  async deactivateAccount(@CurrentUser() user: RequestUser) {
    await this.customerService.deactivateAccount(user.id);
    return { message: 'Account deactivated', data: null };
  }

  // ════════════════════════════════════════════════════════════
  // ORDERS
  // ════════════════════════════════════════════════════════════

  @Get('orders')
  @ApiOperation({
    summary: 'Get my order history',
    description:
      'Paginated list of my orders with product snapshots. Filter by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved',
    schema: {
      example: {
        message: 'Orders retrieved',
        data: {
          data: [
            {
              id: 'clx1',
              orderNumber: 1001,
              status: 'DELIVERED',
              paymentStatus: 'COMPLETED',
              paymentMethod: 'BKASH',
              subTotal: '950.00',
              shippingCost: '60.00',
              discount: '0.00',
              total: '1010.00',
              currency: 'BDT',
              trackingNumber: 'SA1234567BD',
              products: [
                {
                  productName: 'Blue T-Shirt',
                  qty: 2,
                  unitPrice: '475.00',
                  lineTotal: '950.00',
                },
              ],
              createdAt: '2024-03-10T08:00:00.000Z',
              deliveredAt: '2024-03-12T14:00:00.000Z',
            },
          ],
          meta: { total: 12, page: 1, limit: 10, totalPages: 2 },
        },
      },
    },
  })
  async getMyOrders(
    @Query() dto: CustomerOrdersQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.getMyOrders(user.id, dto);
    return { message: 'Orders retrieved', data };
  }

  @Get('orders/:orderId')
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiOperation({
    summary: 'Get single order detail',
    description:
      'Returns full order detail including products, status history, packages, returns, and transaction.',
  })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getMyOrderById(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.getMyOrderById(user.id, orderId);
    return { message: 'Order retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // WALLET
  // ════════════════════════════════════════════════════════════

  @Get('wallet')
  @ApiOperation({
    summary: 'Get my wallet balance and transaction history',
    description: 'Returns wallet info and paginated transaction history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet retrieved',
    schema: {
      example: {
        message: 'Wallet retrieved',
        data: {
          wallet: {
            id: 'clx1',
            balance: '150.00',
            currency: 'BDT',
            isActive: true,
          },
          transactions: [
            {
              id: 'clxt1',
              type: 'CREDIT_CASHBACK',
              amount: '50.00',
              balance: '150.00',
              description: 'Cashback on order #1002',
              createdAt: '2024-03-10T08:00:00.000Z',
            },
          ],
          meta: { total: 5, page: 1, limit: 20, totalPages: 1 },
        },
      },
    },
  })
  async getMyWallet(
    @Query() dto: CustomerWalletQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.getMyWallet(user.id, dto);
    return { message: 'Wallet retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // REVIEWS
  // ════════════════════════════════════════════════════════════

  @Get('reviews')
  @ApiOperation({
    summary: 'Get my submitted reviews',
    description: 'Paginated list of reviews submitted by this customer.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  async getMyReviews(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.getMyReviews(
      user.id,
      Number(page),
      Number(limit),
    );
    return { message: 'Reviews retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // RETURNS
  // ════════════════════════════════════════════════════════════

  @Get('returns')
  @ApiOperation({
    summary: 'Get my return requests',
    description:
      'Paginated list of return requests submitted by this customer.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns retrieved' })
  async getMyReturns(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.getMyReturns(
      user.id,
      Number(page),
      Number(limit),
    );
    return { message: 'Returns retrieved', data };
  }

  // ════════════════════════════════════════════════════════════
  // DEVICES / SESSIONS
  // ════════════════════════════════════════════════════════════

  @Get('devices')
  @ApiOperation({
    summary: 'List my active devices/sessions',
    description: 'Returns all active device sessions for the current account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved',
    schema: {
      example: {
        message: 'Devices retrieved',
        data: [
          {
            id: 'clxd1',
            deviceName: 'Chrome on Windows',
            deviceType: 'browser',
            ipAddress: '192.168.1.1',
            lastActiveAt: '2024-03-17T10:00:00.000Z',
            createdAt: '2024-03-01T08:00:00.000Z',
          },
        ],
      },
    },
  })
  async getMyDevices(@CurrentUser() user: RequestUser) {
    const data = await this.customerService.getMyDevices(user.id);
    return { message: 'Devices retrieved', data };
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'deviceId', description: 'Device ID to revoke' })
  @ApiOperation({
    summary: 'Revoke a specific device session',
    description: 'Logs out that device by revoking its tokens.',
  })
  @ApiResponse({ status: 200, description: 'Device session revoked' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.customerService.revokeDevice(user.id, deviceId);
    return { message: 'Device session revoked', data: null };
  }

  @Post('devices/revoke-all-others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke all other device sessions',
    description: 'Logs out all devices except the one making this request.',
  })
  @ApiResponse({ status: 200, description: 'All other devices revoked' })
  async revokeAllOtherDevices(@CurrentUser() user: RequestUser) {
    const deviceId = (user as any).deviceId;
    await this.customerService.revokeAllOtherDevices(user.id, deviceId);
    return { message: 'All other devices revoked', data: null };
  }
}
