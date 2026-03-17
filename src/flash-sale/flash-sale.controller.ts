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
import { FlashSaleService } from './flash-sale.service';
import {
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  ListFlashSalesDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Flash Sales')
@Controller('flash-sales')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  // ══════════════════════════════════════════════════════════════
  // CREATE FLASH SALE
  // ══════════════════════════════════════════════════════════════
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a new flash sale',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async create(
    @Body() dto: CreateFlashSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.flashSaleService.create(dto, user.id);
    return { message: 'Flash sale created successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL FLASH SALES (ADMIN)
  // ══════════════════════════════════════════════════════════════
  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.VIEW_PRODUCTS)
  @ApiOperation({
    summary: 'Get all flash sales (admin)',
    description: 'Requires VIEW_PRODUCTS permission',
  })
  async findAll(@Query() dto: ListFlashSalesDto) {
    const result = await this.flashSaleService.findAll(dto);
    return {
      message: 'Flash sales retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET ACTIVE FLASH SALES (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'Get active flash sales (public)',
    description: 'Returns all flash sales with active products',
  })
  async findActive() {
    const data = await this.flashSaleService.findActive();
    return { message: 'Active flash sales retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // GET FLASH SALE BY ID (PUBLIC)
  // ══════════════════════════════════════════════════════════════
  @Get(':id')
  @Public()
  @ApiParam({ name: 'id', description: 'Flash sale ID' })
  @ApiOperation({
    summary: 'Get flash sale by ID (public)',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.flashSaleService.findOne(id);
    return { message: 'Flash sale retrieved successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE FLASH SALE
  // ══════════════════════════════════════════════════════════════
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Flash sale ID' })
  @ApiOperation({
    summary: 'Update flash sale',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFlashSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.flashSaleService.update(id, dto, user.id);
    return { message: 'Flash sale updated successfully', data };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE FLASH SALE
  // ══════════════════════════════════════════════════════════════
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Flash sale ID' })
  @ApiOperation({
    summary: 'Delete flash sale (soft delete)',
    description: 'Requires MANAGE_PRODUCTS permission',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.flashSaleService.remove(id, user.id);
    return { message: 'Flash sale deleted successfully', data: null };
  }
}
