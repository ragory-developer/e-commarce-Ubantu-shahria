import {
  Controller,
  Get,
  Put,
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
} from '@nestjs/swagger';
import { SettingsService, UpsertSettingDto } from './settings.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  /** Public — storefront reads checkout rules */
  @Get('public')
  @Public()
  @ApiOperation({ summary: '[Public] Get storefront-safe settings' })
  async getPublic() {
    const data = await this.service.getPublic();
    return { message: 'Settings retrieved', data };
  }

  /** Admin — list all */
  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.SETTINGS_MANAGE)
  @ApiQuery({ name: 'group', required: false })
  @ApiOperation({ summary: '[Admin] List all settings' })
  async list(@Query('group') group?: string) {
    const data = await this.service.list(group);
    return { message: 'Settings retrieved', data };
  }

  /** Admin — upsert single key */
  @Put()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.SETTINGS_MANAGE)
  @ApiOperation({ summary: '[Admin] Create or update a setting' })
  async set(@Body() dto: UpsertSettingDto) {
    const data = await this.service.set(dto);
    return { message: 'Setting saved', data };
  }

  /** Admin — delete */
  @Delete(':key')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.SETTINGS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'key' })
  @ApiOperation({ summary: '[Admin] Soft-delete a setting' })
  async delete(@Param('key') key: string, @CurrentUser() user: RequestUser) {
    await this.service.delete(key, user.id);
    return { message: 'Setting deleted', data: null };
  }
}
