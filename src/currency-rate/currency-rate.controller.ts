import {
  Controller,
  Get,
  Put,
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
import {
  CurrencyRateService,
  UpsertCurrencyRateDto,
} from './currency-rate.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Currency Rates')
@Controller('currency-rates')
export class CurrencyRateController {
  constructor(private readonly service: CurrencyRateService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '[Public] List all active currency rates' })
  async findAll() {
    const data = await this.service.findAll();
    return { message: 'Currency rates retrieved', data };
  }

  @Put()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_CURRENCIES)
  @ApiOperation({ summary: '[Admin] Create or update a currency rate' })
  async upsert(
    @Body() dto: UpsertCurrencyRateDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.upsert(dto, user.id);
    return { message: 'Currency rate saved', data };
  }

  @Delete(':currency')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_CURRENCIES)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'currency', example: 'USD' })
  @ApiOperation({ summary: '[Admin] Soft-delete a currency rate' })
  async remove(
    @Param('currency') currency: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.remove(currency, user.id);
    return { message: 'Currency rate deleted', data: null };
  }
}
