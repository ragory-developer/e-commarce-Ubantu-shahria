import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
  IsInt,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ShippingRuleType } from '@prisma/client';

export class CreateShippingRuleDto {
  @ApiProperty({ example: 'clx_zone_001' })
  @IsString()
  @IsNotEmpty()
  deliveryZoneId!: string;

  @ApiProperty({ example: 'clx_courier_001' })
  @IsString()
  @IsNotEmpty()
  courierId!: string;

  @ApiPropertyOptional({ enum: ShippingRuleType, default: 'FLAT' })
  @IsOptional()
  @IsEnum(ShippingRuleType)
  rateType?: ShippingRuleType;

  @ApiProperty({ example: 60, description: 'Base shipping cost in BDT' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseCost!: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Extra cost per kg (for WEIGHT_BASED)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKgCost?: number;

  @ApiPropertyOptional({
    example: 500,
    description:
      'Order total threshold for free shipping (null = no free shipping)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  freeShippingMinimum?: number | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMaxDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
