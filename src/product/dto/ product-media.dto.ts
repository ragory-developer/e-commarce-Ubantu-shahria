// ─── src/product/dto/product-media.dto.ts ─────────────────────

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddProductMediaDto {
  @ApiProperty({
    example: ['clx_media_001', 'clx_media_002'],
    description: 'Media IDs to add to this product',
  })
  @IsArray()
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({
    example: 'clx_media_001',
    description: 'Set as main/thumbnail image',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;

  @ApiPropertyOptional({
    example: 'gallery',
    description: 'Purpose: gallery | thumbnail | banner',
    default: 'gallery',
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class ReplaceProductMediaDto {
  @ApiProperty({
    example: ['clx_media_001', 'clx_media_002', 'clx_media_003'],
    description: 'Complete new media list. Replaces all existing media.',
  })
  @IsArray()
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({ example: 'clx_media_001' })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

export class ReorderMediaItemDto {
  @ApiProperty({ example: 'clx_media_001' })
  @IsString()
  @IsNotEmpty()
  mediaId!: string;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderProductMediaDto {
  @ApiProperty({
    type: [ReorderMediaItemDto],
    description: 'New order for media items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderMediaItemDto)
  items!: ReorderMediaItemDto[];
}

export class SetMainMediaDto {
  @ApiProperty({
    example: 'clx_media_001',
    description: 'Media ID to set as main image',
  })
  @IsString()
  @IsNotEmpty()
  mediaId!: string;
}
