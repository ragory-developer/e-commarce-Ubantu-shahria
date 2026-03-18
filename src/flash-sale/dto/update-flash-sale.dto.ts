// src/flash-sale/dto/update-flash-sale.dto.ts
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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { FlashSaleProductItemDto } from './create-flash-sale.dto';

export class UpdateFlashSaleDto {
  @ApiPropertyOptional({ example: 'Spring Sale 2026 Updated' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'Up to 60% off' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-03-20T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-03-20T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ enum: ['FIXED', 'PERCENT'] })
  @IsOptional()
  @IsEnum(['FIXED', 'PERCENT'])
  discountType?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [FlashSaleProductItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashSaleProductItemDto)
  products?: FlashSaleProductItemDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}
