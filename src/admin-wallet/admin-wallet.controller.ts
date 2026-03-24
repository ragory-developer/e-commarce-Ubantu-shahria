import {
  Controller,
  Get,
  Post,
  Patch,
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
import {
  AdminWalletService,
  AdminWalletAdjustDto,
  ListWalletTxDto,
} from './admin-wallet.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Admin — Wallet')
@ApiBearerAuth('access-token')
@UserType('ADMIN')
@Controller('admin/customers/:customerId/wallet')
export class AdminWalletController {
  constructor(private readonly service: AdminWalletService) {}

  @Get()
  @Permissions(AdminPermission.FINANCE_VIEW)
  @ApiParam({ name: 'customerId' })
  @ApiOperation({ summary: 'Get customer wallet summary' })
  async getWallet(@Param('customerId') customerId: string) {
    const data = await this.service.getWallet(customerId);
    return { message: 'Wallet retrieved', data };
  }

  @Get('transactions')
  @Permissions(AdminPermission.FINANCE_VIEW)
  @ApiParam({ name: 'customerId' })
  @ApiOperation({ summary: 'List wallet transactions with pagination' })
  async getTransactions(
    @Param('customerId') customerId: string,
    @Query() dto: ListWalletTxDto,
  ) {
    const data = await this.service.getTransactions(customerId, dto);
    return { message: 'Transactions retrieved', data };
  }

  @Post('adjust')
  @Permissions(AdminPermission.FINANCE_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'customerId' })
  @ApiOperation({ summary: 'Manually credit or debit a customer wallet' })
  async adjust(
    @Param('customerId') customerId: string,
    @Body() dto: AdminWalletAdjustDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.adjust(customerId, dto, user.id);
    return {
      message: `Wallet ${dto.type === 'CREDIT_ADJUSTMENT' ? 'credited' : 'debited'}`,
      data,
    };
  }

  @Patch('disable')
  @Permissions(AdminPermission.FINANCE_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'customerId' })
  @ApiOperation({ summary: 'Disable customer wallet' })
  async disable(
    @Param('customerId') customerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.setActive(customerId, false, user.id);
    return { message: 'Wallet disabled', data: null };
  }

  @Patch('enable')
  @Permissions(AdminPermission.FINANCE_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'customerId' })
  @ApiOperation({ summary: 'Re-enable customer wallet' })
  async enable(
    @Param('customerId') customerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.setActive(customerId, true, user.id);
    return { message: 'Wallet enabled', data: null };
  }
}
