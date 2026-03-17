// ─── src/variation/dto/list-variations.dto.ts ─────────────────

import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListVariationsDto {
  @ApiPropertyOptional({ example: 0, default: 0, description: 'Skip records' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Take records',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take: number = 20;

  @ApiPropertyOptional({ example: 'size', description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;
}
