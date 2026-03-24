import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus, PackageStatus } from '@prisma/client';

// ─── Admin List Orders ──────────────────────────────────────────
export class AdminListOrdersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string; // order number, phone, email

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─── Update Order Status ────────────────────────────────────────
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ example: 'Confirmed by customer support' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'PATHAO-123456789' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

// ─── Create Package ────────────────────────────────────────────
export class CreatePackageItemDto {
  @ApiProperty({ example: 'clx_orderproduct_001' })
  @IsString()
  @IsNotEmpty()
  orderProductId!: string;

  @ApiProperty({ example: 'Classic T-Shirt (XL/Red)' })
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  weight?: number;
}

export class CreatePackageDto {
  @ApiProperty({ example: 'clx_courier_001' })
  @IsString()
  @IsNotEmpty()
  courierId!: string;

  @ApiPropertyOptional({ example: 'clx_rider_001' })
  @IsOptional()
  @IsString()
  riderId?: string;

  @ApiProperty({ type: [CreatePackageItemDto] })
  @IsArray()
  items!: CreatePackageItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

// ─── Update Package Status ─────────────────────────────────────
export class UpdatePackageStatusDto {
  @ApiProperty({ enum: PackageStatus })
  @IsEnum(PackageStatus)
  status!: PackageStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  deliveryDetails?: Record<string, any>;
}
