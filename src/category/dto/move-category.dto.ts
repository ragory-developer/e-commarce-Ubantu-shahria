import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoveCategoryDto {
  @ApiProperty({
    example: 'new_parent_id_123',
    description: 'New parent category ID (null for root)',
  })
  @IsOptional()
  @IsString()
  newParentId?: string | null;

  @ApiPropertyOptional({ example: 0, description: 'Position in new parent' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
