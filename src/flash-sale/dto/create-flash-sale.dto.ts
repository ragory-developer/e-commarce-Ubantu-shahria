import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
  IsDateString,
  IsNumber,
  IsObject,
  IsBoolean,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class FlashSaleProductItemDto {
  @ApiProperty({ example: 'clx_product_123' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({ example: 'clx_variant_123' })
  @IsOptional()
  @IsString()
  productVariantId?: string;

  @ApiProperty({
    example: 99.99,
    description: 'Flash sale price — must be lower than regular price',
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({
    example: 100,
    description: 'Available quantity for flash sale',
  })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateFlashSaleDto {
  @ApiProperty({ example: 'Spring Sale 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string; // ← was campaignName

  @ApiPropertyOptional({ example: 'Up to 50% off on selected items' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '2026-03-20T00:00:00Z',
    description: 'Sale start time',
  })
  @IsDateString()
  startTime!: string; // ← matches schema

  @ApiProperty({
    example: '2026-03-20T23:59:59Z',
    description: 'Sale end time',
  })
  @IsDateString()
  endTime!: string; // ← matches schema

  @ApiPropertyOptional({ example: 'PERCENT', enum: ['FIXED', 'PERCENT'] })
  @IsOptional()
  @IsEnum(['FIXED', 'PERCENT'])
  discountType?: string;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Overall campaign discount (individual product prices override this)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiProperty({ type: [FlashSaleProductItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashSaleProductItemDto)
  products!: FlashSaleProductItemDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
