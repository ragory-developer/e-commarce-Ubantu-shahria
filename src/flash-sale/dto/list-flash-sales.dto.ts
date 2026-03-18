// src/flash-sale/dto/list-flash-sales.dto.ts
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { FlashSaleStatus } from '@prisma/client';

export class ListFlashSalesDto {
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

  @ApiPropertyOptional({ example: 'Spring Sale' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: FlashSaleStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(FlashSaleStatus)
  status?: FlashSaleStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Show only active flash sales',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;
}
