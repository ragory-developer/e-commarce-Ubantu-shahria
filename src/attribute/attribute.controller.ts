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

import { AttributeService } from './attribute.service';
import {
  CreateAttributeDto,
  UpdateAttributeDto,
  ListAttributesDto,
  AddAttributeValuesDto,
  UpdateAttributeValuesDto,
} from './dto';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';

import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';

@ApiTags('Attributes')
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  // CREATE ATTRIBUTE
  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create a new attribute',
    description:
      'e.g., "Brand", "Processor", "Color". Attribute must belong to an attribute set.',
  })
  async create(
    @Body() dto: CreateAttributeDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.create(dto, user.id);
    return {
      message: 'Attribute created successfully',
      data,
    };
  }

  // GET ALL ATTRIBUTES
  @Get()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'List all attributes with pagination and filter by attribute set',
  })
  async findAll(@Query() dto: ListAttributesDto) {
    const result = await this.attributeService.findAll(dto);
    return {
      message: 'Attributes retrieved successfully',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  // GET ATTRIBUTES BY ATTRIBUTE SET
  @Get('attribute-set/:attributeSetId')
  @Public()
  @ApiParam({ name: 'attributeSetId', description: 'Attribute Set ID' })
  @ApiOperation({
    summary: 'Get all attributes in a set (public)',
    description: 'Returns attributes with their values',
  })
  async findByAttributeSet(@Param('attributeSetId') attributeSetId: string) {
    const data = await this.attributeService.findByAttributeSet(attributeSetId);
    return {
      message: 'Attributes retrieved successfully',
      data,
    };
  }

  // GET ATTRIBUTE BY ID
  @Get(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Get attribute with all its values',
  })
  async findOne(@Param('id') id: string) {
    const data = await this.attributeService.findOne(id);
    return {
      message: 'Attribute retrieved successfully',
      data,
    };
  }

  // UPDATE ATTRIBUTE
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Update attribute (name, type, slug, position, translations)',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.update(id, dto, user.id);
    return {
      message: 'Attribute updated successfully',
      data,
    };
  }

  // ADD ATTRIBUTE VALUES
  @Post(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Add values to an attribute',
    description: 'e.g., add colors ["Red", "Blue", "Green"] to Color attribute',
  })
  async addValues(
    @Param('id') id: string,
    @Body() dto: AddAttributeValuesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.addValues(id, dto, user.id);
    return {
      message: `Added ${data.length} values to attribute`,
      data,
    };
  }

  // UPDATE ATTRIBUTE VALUES
  @Patch(':id/values')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Update/replace all attribute values',
  })
  async updateValues(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeValuesDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.attributeService.updateValues(id, dto, user.id);
    return {
      message: 'Attribute values updated successfully',
      data,
    };
  }

  // DELETE ATTRIBUTE VALUE
  @Delete(':id/values/:valueId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiParam({ name: 'valueId', description: 'Attribute Value ID' })
  @ApiOperation({
    summary: 'Delete an attribute value (soft delete)',
  })
  async deleteValue(
    @Param('id') id: string,
    @Param('valueId') valueId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.attributeService.deleteValue(id, valueId, user.id);
    return {
      message: 'Attribute value deleted successfully',
      data: null,
    };
  }

  // DELETE ATTRIBUTE
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Attribute ID' })
  @ApiOperation({
    summary: 'Delete attribute (soft delete)',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.attributeService.remove(id, user.id);
    return {
      message: 'Attribute deleted successfully',
      data: null,
    };
  }
}
