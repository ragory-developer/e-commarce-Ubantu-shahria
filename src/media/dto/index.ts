// ─── src/media/dto/index.ts ──────────────────────────────────

import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Upload DTO ────────────────────────────────────────────────
export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: any;
}

// ─── Link Media to Entity DTO ─────────────────────────────────
export class LinkMediaToEntityDto {
  @ApiProperty({
    example: 'Product',
    description: 'Entity type (Product, Category, Brand, Tag, Admin, Customer)',
  })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({ example: 'clx1234567890abcdef', description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({
    example: ['media_id_1', 'media_id_2'],
    description: 'Array of media IDs to link',
  })
  @IsArray()
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({
    example: 'gallery',
    description: 'Purpose: gallery, thumbnail, icon, banner, logo, avatar',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({
    example: 'media_id_1',
    description: 'ID of the media to mark as main/primary',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

// ─── Update Entity Media DTO ──────────────────────────────────
export class UpdateEntityMediaDto {
  @ApiProperty({
    example: 'Product',
    description: 'Entity type',
  })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({ example: 'clx1234567890abcdef', description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({
    example: ['media_id_1', 'media_id_2', 'media_id_3'],
    description: 'New array of media IDs (replaces existing)',
  })
  @IsArray()
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({
    example: 'gallery',
    description: 'Purpose filter',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({
    example: 'media_id_1',
    description: 'ID of the media to mark as main',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

// ─── Get Entity Media DTO ─────────────────────────────────────
export class GetEntityMediaDto {
  @ApiProperty({ example: 'Product', description: 'Entity type' })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({ example: 'clx1234567890abcdef', description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiPropertyOptional({
    example: 'gallery',
    description: 'Filter by purpose',
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}

// ─── List Media DTO ───────────────────────────────────────────
export class ListMediaDto {
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

  @ApiPropertyOptional({
    example: 'image',
    description: 'Filter by MIME type (partial match)',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'local',
    description: 'Filter by storage driver',
    enum: ['local', 'cloudinary'],
  })
  @IsOptional()
  @IsIn(['local', 'cloudinary'])
  storageDriver?: 'local' | 'cloudinary';
}
