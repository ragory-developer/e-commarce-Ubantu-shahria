import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CouponDiscountType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'Summer Sale 20% Off' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  @ApiPropertyOptional({ example: 'Save 20% on summer items' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: CouponDiscountType, example: 'PERCENT' })
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @ApiProperty({
    example: 20,
    description: 'Percentage (0-100) or fixed amount',
  })
  @IsNumber()
  @Min(0)
  discountValue!: number; // ← matches schema

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number; // ← matches schema

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrderValue?: number; // ← matches schema

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number; // ← matches schema

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  userUsageLimit?: number; // ← matches schema

  @ApiProperty({
    example: '2026-01-01T00:00:00Z',
    description: 'Coupon valid from',
  })
  @IsDateString()
  validFrom!: string; // ← matches schema

  @ApiProperty({
    example: '2026-12-31T23:59:59Z',
    description: 'Coupon valid to',
  })
  @IsDateString()
  validTo!: string; // ← matches schema

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
