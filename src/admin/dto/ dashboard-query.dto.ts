// ─── src/admin/dto/dashboard-query.dto.ts ───────────────────
import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: '7d',
    enum: ['1d', '7d', '30d', '90d', '1y'],
    description: 'Time range for dashboard stats',
    default: '7d',
  })
  @IsOptional()
  @IsIn(['1d', '7d', '30d', '90d', '1y'])
  range?: '1d' | '7d' | '30d' | '90d' | '1y' = '7d';
}
