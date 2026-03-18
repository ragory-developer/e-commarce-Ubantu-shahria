import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateDeliveryZoneDto {
  @ApiProperty({ example: 'Dhaka Metropolitan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'dhaka-metro' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim().toLowerCase())
  slug!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Area IDs to assign to this zone',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areaIds?: string[];
}
