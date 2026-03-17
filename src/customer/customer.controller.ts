import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import {
  UpdateCustomerProfileDto,
  ChangePasswordDto,
  UpgradeGuestDto,
} from './dto';

@ApiTags('Customer — Profile')
@ApiBearerAuth('access-token')
@UserType('CUSTOMER')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ─── Get own profile ──────────────────────────────────────────
  @Get('profile')
  @ApiOperation({ summary: 'Get my profile' })
  async getProfile(@CurrentUser() user: RequestUser) {
    const data = await this.customerService.getProfile(user.id);
    return { message: 'Profile retrieved', data };
  }

  // ─── Update own profile ───────────────────────────────────────
  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile (name, email, avatar)' })
  async updateProfile(
    @Body() dto: UpdateCustomerProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.updateProfile(user.id, dto);
    return { message: 'Profile updated', data };
  }

  // ─── Change password ──────────────────────────────────────────
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change my password (must provide current password)',
  })
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

  // ─── Upgrade guest to full account ────────────────────────────
  @Post('upgrade-to-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade guest account to full account',
    description:
      'Requires phone to be verified first (POST /auth/customer/verify-phone/request). ' +
      'Sets a password and optionally name/email. Same customer ID — all orders preserved.',
  })
  async upgradeGuest(
    @Body() dto: UpgradeGuestDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.customerService.upgradeGuest(user.id, dto);
    return { message: 'Account upgraded successfully', data };
  }

  // ─── Deactivate own account ────────────────────────────────────
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate my account (soft — all sessions revoked)',
  })
  async deactivateAccount(@CurrentUser() user: RequestUser) {
    await this.customerService.deactivateAccount(user.id);
    return { message: 'Account deactivated', data: null };
  }
}
