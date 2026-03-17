import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
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
  @ApiProperty({
    example: 'Summer Sale 20% Off',
    description: 'Display name of the coupon',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'SUMMER20',
    description: 'Unique coupon code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  @ApiProperty({
    enum: CouponDiscountType,
    example: CouponDiscountType.PERCENT,
    description: 'Type of discount',
  })
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @ApiProperty({
    example: 20,
    description: 'Discount value (percentage or fixed amount)',
  })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable free shipping',
  })
  @IsOptional()
  @IsBoolean()
  freeShipping?: boolean;

  @ApiPropertyOptional({
    example: 100,
    description: 'Minimum order amount required',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumSpend?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Maximum order amount allowed',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumSpend?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Total usage limit for this coupon',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerCoupon?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Usage limit per customer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerCustomer?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Is coupon active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '2026-03-01T00:00:00Z',
    description: 'Start date for coupon validity',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-03-31T23:59:59Z',
    description: 'End date for coupon validity',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Translations for coupon name',
    example: {
      bn: { name: 'গ্রীষ্মকালীন ছাড় ২০%' },
      ar: { name: 'خصم الصيف ٢٠٪' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiPropertyOptional({
    type: [String],
    description: 'Product IDs to include (empty = all products)',
    example: ['product_id_1', 'product_id_2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  products?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Category IDs to include (empty = all categories)',
    example: ['category_id_1', 'category_id_2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
