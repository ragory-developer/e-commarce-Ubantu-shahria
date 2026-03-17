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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { AddressService } from './address.service';

@ApiTags('Customer — Addresses')
@ApiBearerAuth('access-token')
@UserType('CUSTOMER')
@Controller('customer/addresses')
export class AddressController {
  constructor(private readonly service: AddressService) {}

  @Get()
  @ApiOperation({ summary: 'List all my addresses' })
  async list(@CurrentUser() user: RequestUser) {
    const data = await this.service.list(user.id);
    return { message: 'Addresses retrieved', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single address' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.service.findOne(id, user.id);
    return { message: 'Address retrieved', data };
  }

  @Post()
  @ApiOperation({ summary: 'Add a new address' })
  async create(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(user.id, user.id, dto);
    return { message: 'Address added', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.update(id, user.id, user.id, dto);
    return { message: 'Address updated', data };
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set as default address' })
  async setDefault(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.setDefault(id, user.id, user.id);
    return { message: 'Default address updated', data: null };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete address (soft)' })
  async delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.delete(id, user.id, user.id);
    return { message: 'Address deleted', data: null };
  }
}
