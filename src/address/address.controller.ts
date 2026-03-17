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
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { AddressService } from './address.service';

@ApiTags('Customer — Address Book')
@ApiBearerAuth('access-token')
@UserType('CUSTOMER')
@Controller('customer/addresses')
export class AddressController {
  constructor(private readonly service: AddressService) {}

  @Get()
  @ApiOperation({
    summary: 'List all my addresses',
    description:
      'Returns all addresses ordered by default first, then by creation date',
  })
  @ApiResponse({
    status: 200,
    description: 'Addresses retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Addresses retrieved',
        data: [
          {
            id: 'clx123',
            label: 'Home',
            fullName: 'John Doe',
            phone: '01712345678',
            addressLine: 'House 123, Road 5, Gulshan',
            postalCode: '1212',
            country: 'BD',
            isDefault: true,
            division: { id: 'clx1', name: 'Dhaka' },
            city: { id: 'clx2', name: 'Dhaka' },
            area: {
              id: 'clx3',
              name: 'Gulshan 1',
              postalCode: '1212',
              deliveryZone: { id: 'clx4', name: 'Dhaka North' },
            },
            createdAt: '2024-03-17T10:30:00.000Z',
          },
        ],
      },
    },
  })
  async list(@CurrentUser() user: RequestUser) {
    const data = await this.service.list(user.id);
    return { message: 'Addresses retrieved', data };
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOperation({ summary: 'Get a single address' })
  @ApiResponse({
    status: 200,
    description: 'Address retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const data = await this.service.findOne(id, user.id);
    return { message: 'Address retrieved', data };
  }

  @Post()
  @ApiOperation({
    summary: 'Add a new address',
    description:
      'Creates a new address. First address is automatically set as default.',
  })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
    schema: {
      example: {
        success: true,
        message: 'Address added',
        data: {
          id: 'clx123',
          label: 'Home',
          fullName: 'John Doe',
          phone: '01712345678',
          isDefault: true,
          division: { id: 'clx1', name: 'Dhaka' },
          city: { id: 'clx2', name: 'Dhaka' },
          area: { id: 'clx3', name: 'Gulshan 1' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid location hierarchy or validation error',
  })
  async create(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.service.create(user.id, user.id, dto);
    return { message: 'Address added', data };
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOperation({ summary: 'Update address' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
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
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOperation({
    summary: 'Set as default address',
    description: 'Sets this address as default and unsets others',
  })
  @ApiResponse({
    status: 200,
    description: 'Default address updated',
  })
  async setDefault(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.setDefault(id, user.id, user.id);
    return { message: 'Default address updated', data: null };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiOperation({
    summary: 'Delete address (soft delete)',
    description:
      'Soft deletes the address. If it was default, promotes the next address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Address deleted',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.service.delete(id, user.id, user.id);
    return { message: 'Address deleted', data: null };
  }

  @Get('default/current')
  @ApiOperation({
    summary: 'Get my default address',
    description: 'Returns the current default address',
  })
  @ApiResponse({
    status: 200,
    description: 'Default address retrieved',
  })
  async getDefault(@CurrentUser() user: RequestUser) {
    const data = await this.service.getDefaultAddress(user.id);
    return {
      message: data ? 'Default address retrieved' : 'No default address set',
      data,
    };
  }
}
