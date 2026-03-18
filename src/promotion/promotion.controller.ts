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
} from '@nestjs/swagger';
import { PromotionService } from './promotion.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ListPromotionsDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionController {
  constructor(private readonly service: PromotionService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PROMOTIONS)
  @ApiOperation({
    summary:
      'Create a promotion (auto-apply discount, free shipping, buy X get Y, etc.)',
  })
  async create(
    @Body() dto: CreatePromotionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(dto, user.id);
    return { message: 'Promotion created', data };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '[Public] List active promotions' })
  async findAll(@Query() dto: ListPromotionsDto) {
    const result = await this.service.findAll(dto);
    return {
      message: 'Promotions retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get promotion by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.service.findOne(id);
    return { message: 'Promotion retrieved', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PROMOTIONS)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update promotion' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.update(id, dto, user.id);
    return { message: 'Promotion updated', data };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PROMOTIONS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Delete promotion (soft delete)' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.remove(id, user.id);
    return { message: 'Promotion deleted', data: null };
  }
}
