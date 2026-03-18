import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PromotionType } from '@prisma/client';

export class CreatePromotionDto {
  @ApiProperty({ example: 'Summer Free Shipping' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'summer-free-shipping' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromotionType, example: 'FREE_SHIPPING' })
  @IsEnum(PromotionType)
  type!: PromotionType;

  @ApiPropertyOptional({
    example: true,
    description: 'Automatically apply to all eligible carts',
  })
  @IsOptional()
  @IsBoolean()
  isAutoApply?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Can stack with other promotions',
  })
  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @ApiPropertyOptional({ example: 10, description: 'Higher = applied first' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({
    description: 'Promotion rules object. Shape depends on type.',
    example: { minCartValue: 500, discountType: 'PERCENT', discountValue: 10 },
  })
  @IsObject()
  rules!: object;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
