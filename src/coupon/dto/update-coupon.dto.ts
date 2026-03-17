import { PartialType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// ─── Update DTO ────────────────────────────────────────────────
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

// ─── List DTO ──────────────────────────────────────────────────
export class ListCouponsDto {
  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;

  @ApiPropertyOptional({ example: 'SUMMER' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Show only active coupons',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;
}

// ─── Validate Coupon DTO ───────────────────────────────────────
export class ValidateCouponDto {
  @ApiProperty({
    example: 'SUMMER20',
    description: 'Coupon code to validate',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toUpperCase())
  code!: string;

  @ApiProperty({
    example: 250.5,
    description: 'Order total amount',
  })
  @IsNumber()
  @Min(0)
  orderTotal!: number;

  @ApiPropertyOptional({
    example: 'customer_id_123',
    description: 'Customer ID (for usage tracking)',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Product IDs in cart',
    example: ['product_id_1', 'product_id_2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Category IDs in cart',
    example: ['category_id_1'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
