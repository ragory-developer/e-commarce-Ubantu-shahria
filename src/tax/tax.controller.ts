// ─── src/tax/tax.controller.ts ────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { TaxService } from './tax.service';
import {
  CreateTaxClassDto,
  UpdateTaxClassDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  ListTaxClassesDto,
  ListTaxRatesDto,
} from './dto';
import { UserType } from '../common/decorators/user-type.decorator';

@ApiTags('Tax Management')
@ApiBearerAuth('access-token')
@Controller('tax')
@UserType('ADMIN')
@ApiExtraModels(
  CreateTaxClassDto,
  UpdateTaxClassDto,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  ListTaxClassesDto,
  ListTaxRatesDto,
)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // ══════════════════════════════════════════════════════════════
  // TAX CLASSES
  // ══════════════════════════════════════════════════════════════

  @Post('classes')
  @ApiOperation({
    summary: 'Create a new tax class',
    description:
      'Creates a new tax class that defines how tax should be calculated. Tax classes group related tax rates and specify whether to use billing, shipping, or store address for calculations.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tax class created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clx_taxclass_001' },
        name: { type: 'string', example: 'Standard Tax' },
        basedOn: { type: 'string', example: 'SHIPPING_ADDRESS' },
        translations: {
          type: 'object',
          example: { bn: { name: 'স্ট্যান্ডার্ড ট্যাক্স' } },
        },
        rates: {
          type: 'array',
          items: { type: 'object' },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Tax class with this name already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  createClass(@Body() dto: CreateTaxClassDto, @Req() req: any) {
    return this.taxService.createTaxClass(dto);
  }

  @Get('classes')
  @ApiOperation({
    summary: 'List all tax classes',
    description:
      'Retrieves a paginated list of tax classes with their associated tax rates. Supports filtering by name and tax basis.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tax classes retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              basedOn: { type: 'string' },
              rates: { type: 'array', items: { type: 'object' } },
              _count: {
                type: 'object',
                properties: { products: { type: 'integer' } },
              },
            },
          },
        },
        total: { type: 'integer', example: 10 },
        meta: {
          type: 'object',
          properties: {
            skip: { type: 'integer', example: 0 },
            take: { type: 'integer', example: 50 },
            hasMore: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  findAllClasses(@Query() dto: ListTaxClassesDto) {
    return this.taxService.findAllTaxClasses(dto);
  }

  @Get('classes/:id')
  @ApiOperation({
    summary: 'Get tax class by ID',
    description:
      'Retrieves detailed information about a specific tax class including all its tax rates and product usage count.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax class unique identifier',
    example: 'clx_taxclass_001',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax class found',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax class not found',
  })
  findOneClass(@Param('id') id: string) {
    return this.taxService.findOneTaxClass(id);
  }

  @Patch('classes/:id')
  @ApiOperation({
    summary: 'Update tax class',
    description:
      'Updates an existing tax class. All fields are optional. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax class unique identifier',
    example: 'clx_taxclass_001',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax class updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax class not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tax class name already exists',
  })
  updateClass(@Param('id') id: string, @Body() dto: UpdateTaxClassDto) {
    return this.taxService.updateTaxClass(id, dto);
  }

  @Delete('classes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete tax class (soft delete)',
    description:
      'Soft deletes a tax class. The tax class will be marked as deleted but preserved in the database for audit purposes. Cannot delete if tax class is currently used by products.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax class unique identifier',
    example: 'clx_taxclass_001',
  })
  @ApiResponse({
    status: 204,
    description: 'Tax class deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax class not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete tax class that is in use by products',
  })
  removeClass(@Param('id') id: string, @Req() req: any) {
    return this.taxService.removeTaxClass(id, req.user.sub);
  }

  // ══════════════════════════════════════════════════════════════
  // TAX RATES
  // ══════════════════════════════════════════════════════════════

  @Post('rates')
  @ApiOperation({
    summary: 'Create a new tax rate',
    description:
      'Creates a new tax rate within a tax class. Tax rates define the percentage to charge based on geographic location (country, state, city, ZIP). Use "*" as wildcard for any location field.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tax rate created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clx_taxrate_001' },
        taxClassId: { type: 'string', example: 'clx_taxclass_001' },
        name: { type: 'string', example: 'VAT 15%' },
        country: { type: 'string', example: 'BD' },
        state: { type: 'string', example: 'Dhaka' },
        city: { type: 'string', example: 'Dhaka' },
        zip: { type: 'string', example: '*' },
        rate: { type: 'number', example: 15.0 },
        position: { type: 'integer', example: 0 },
        taxClass: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            basedOn: { type: 'string' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Tax class not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tax rate already exists for this location',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  createRate(@Body() dto: CreateTaxRateDto) {
    return this.taxService.createTaxRate(dto);
  }

  @Get('rates')
  @ApiOperation({
    summary: 'List all tax rates',
    description:
      'Retrieves a paginated list of tax rates with optional filtering by tax class, country, state, or search term.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tax rates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              country: { type: 'string' },
              state: { type: 'string' },
              city: { type: 'string' },
              zip: { type: 'string' },
              rate: { type: 'number' },
              position: { type: 'integer' },
              taxClass: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  basedOn: { type: 'string' },
                },
              },
            },
          },
        },
        total: { type: 'integer', example: 25 },
        meta: {
          type: 'object',
          properties: {
            skip: { type: 'integer', example: 0 },
            take: { type: 'integer', example: 50 },
            hasMore: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  findAllRates(@Query() dto: ListTaxRatesDto) {
    return this.taxService.findAllTaxRates(dto);
  }

  @Get('rates/:id')
  @ApiOperation({
    summary: 'Get tax rate by ID',
    description:
      'Retrieves detailed information about a specific tax rate including its associated tax class.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax rate unique identifier',
    example: 'clx_taxrate_001',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax rate found',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax rate not found',
  })
  findOneRate(@Param('id') id: string) {
    return this.taxService.findOneTaxRate(id);
  }

  @Patch('rates/:id')
  @ApiOperation({
    summary: 'Update tax rate',
    description:
      'Updates an existing tax rate. All fields except taxClassId are optional. Tax rates cannot be moved between tax classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax rate unique identifier',
    example: 'clx_taxrate_001',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax rate updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax rate not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tax rate already exists for this location',
  })
  updateRate(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.taxService.updateTaxRate(id, dto);
  }

  @Delete('rates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete tax rate (soft delete)',
    description:
      'Soft deletes a tax rate. The rate will be marked as deleted but preserved in the database for audit purposes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax rate unique identifier',
    example: 'clx_taxrate_001',
  })
  @ApiResponse({
    status: 204,
    description: 'Tax rate deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax rate not found',
  })
  removeRate(@Param('id') id: string, @Req() req: any) {
    return this.taxService.removeTaxRate(id, req.user.sub);
  }
}
