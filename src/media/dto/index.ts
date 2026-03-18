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
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * ─────────────────────────────────────────────────────────────
 * ENUMS & CONSTANTS
 * ─────────────────────────────────────────────────────────────
 */

export enum MediaEntityType {
  PRODUCT = 'Product',
  CATEGORY = 'Category',
  BRAND = 'Brand',
  CUSTOMER = 'Customer',
  ADMIN = 'Admin',
  BLOG = 'Blog',
  BANNER = 'Banner',
  TAG = 'Tag',
}

export enum MediaPurpose {
  GALLERY = 'gallery',
  THUMBNAIL = 'thumbnail',
  ICON = 'icon',
  BANNER = 'banner',
  LOGO = 'logo',
  AVATAR = 'avatar',
  FEATURED = 'featured',
  HERO = 'hero',
}

/**
 * ─────────────────────────────────────────────────────────────
 * REQUEST DTOs
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Upload Media DTO
 * Used for single file upload
 */
export class UploadMediaDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Media file (image or PDF)',
  })
  file!: any;
}

/**
 * Link Media to Entity DTO
 * Used to link media files to entities
 */
export class LinkMediaToEntityDto {
  @ApiProperty({
    enum: MediaEntityType,
    example: 'Product',
    description:
      'Entity type: Product, Category, Brand, Customer, Admin, Blog, Banner, Tag',
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({
    example: 'clx1234567890abcdef',
    description: 'Entity ID',
  })
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
    enum: MediaPurpose,
    example: 'gallery',
    description:
      'Purpose of media: gallery, thumbnail, icon, banner, logo, avatar, featured, hero',
  })
  @IsOptional()
  @IsEnum(MediaPurpose)
  purpose?: string;

  @ApiPropertyOptional({
    example: 'media_id_1',
    description: 'ID of the media to mark as main/primary',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

/**
 * Update Entity Media DTO
 * Used to update media linked to an entity
 */
export class UpdateEntityMediaDto {
  @ApiProperty({
    enum: MediaEntityType,
    description: 'Entity type',
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({
    example: 'clx1234567890abcdef',
    description: 'Entity ID',
  })
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
    enum: MediaPurpose,
    description: 'Purpose filter',
  })
  @IsOptional()
  @IsEnum(MediaPurpose)
  purpose?: string;

  @ApiPropertyOptional({
    example: 'media_id_1',
    description: 'ID of the media to mark as main',
  })
  @IsOptional()
  @IsString()
  mainMediaId?: string;
}

/**
 * Get Entity Media DTO
 * Used to retrieve media for an entity
 */
export class GetEntityMediaDto {
  @ApiProperty({
    enum: MediaEntityType,
    description: 'Entity type',
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({
    example: 'clx1234567890abcdef',
    description: 'Entity ID',
  })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiPropertyOptional({
    enum: MediaPurpose,
    description: 'Filter by purpose',
  })
  @IsOptional()
  @IsEnum(MediaPurpose)
  purpose?: string;
}

/**
 * List Media DTO
 * Used for pagination and filtering
 */
export class ListMediaDto {
  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Number of records to skip',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Number of records to return',
  })
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
    enum: ['local', 's3', 'cloudinary', 'gcs'],
  })
  @IsOptional()
  @IsIn(['local', 's3', 'cloudinary', 'gcs'])
  storageDriver?: 'local' | 's3' | 'cloudinary' | 'gcs';

  @ApiPropertyOptional({
    example: 'clx1234567890abcdef',
    description: 'Filter by entity type and ID',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    enum: MediaEntityType,
    description: 'Filter by entity type',
  })
  @IsOptional()
  @IsEnum(MediaEntityType)
  entityType?: string;

  @ApiPropertyOptional({
    example: 'asc',
    description: 'Sort order: asc or desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/**
 * Update Media Metadata DTO
 * Used to update media alt text and other metadata
 */
export class UpdateMediaMetadataDto {
  @ApiProperty({
    example: 'clx1234567890abcdef',
    description: 'Media ID',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional({
    example: 'Product image showing blue shirt',
    description: 'Alt text for accessibility',
  })
  @IsOptional()
  @IsString()
  alt?: string;
}

/**
 * Bulk Delete Media DTO
 * Used to delete multiple media files
 */
export class BulkDeleteMediaDto {
  @ApiProperty({
    example: ['media_id_1', 'media_id_2'],
    description: 'Array of media IDs to delete',
  })
  @IsArray()
  @IsString({ each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Force delete even if in use (default: false)',
  })
  @IsOptional()
  force?: boolean;
}

/**
 * Reorder Entity Media DTO
 * Used to reorder media for an entity
 */
export class ReorderEntityMediaDto {
  @ApiProperty({
    enum: MediaEntityType,
    description: 'Entity type',
  })
  @IsEnum(MediaEntityType)
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({
    example: 'clx1234567890abcdef',
    description: 'Entity ID',
  })
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({
    example: ['media_id_2', 'media_id_1', 'media_id_3'],
    description: 'Ordered array of media IDs',
  })
  @IsArray()
  @IsString({ each: true })
  orderedMediaIds!: string[];

  @ApiPropertyOptional({
    enum: MediaPurpose,
    description: 'Purpose filter',
  })
  @IsOptional()
  @IsEnum(MediaPurpose)
  purpose?: string;
}

/**
 * ─────────────────────────────────────────────────────────────
 * RESPONSE DTOs
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Media Variant DTO
 * Represents image variants (thumbnail, medium, original)
 */
export class MediaVariantDto {
  url!: string;
  width?: number;
  height?: number;
}

/**
 * Entity Media Link DTO
 * Represents the relationship between media and entities
 */
export class EntityMediaLinkDto {
  id!: string;
  entityType!: string;
  entityId!: string;
  mediaId!: string;
  position!: number;
  purpose?: string;
  isMain!: boolean;
  createdAt!: Date;
}

/**
 * Media Response DTO
 * Complete media information
 */
export class MediaResponseDto {
  id!: string;
  filename!: string;
  originalName!: string;
  mimeType!: string;
  size!: number;
  extension!: string;
  storageDriver!: string;
  storageUrl!: string;
  variants?: Record<string, MediaVariantDto>;
  width?: number;
  height?: number;
  alt?: string;
  referenceCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy?: string;
}

/**
 * Entity Media Response DTO
 * Media with entity linking information
 */
export class EntityMediaResponseDto extends MediaResponseDto {
  purpose?: string;
  position!: number;
  isMain!: boolean;
}

/**
 * Paginated Media Response DTO
 */
export class PaginatedMediaResponseDto {
  data!: MediaResponseDto[];
  meta!: {
    total: number;
    skip: number;
    take: number;
    hasMore: boolean;
  };
}

/**
 * Media Usage DTO
 * Shows where media is being used
 */
export class MediaUsageDto {
  id!: string;
  referenceCount!: number;
  usage!: Array<{
    entityType: string;
    entityId: string;
    purpose?: string;
    isMain: boolean;
  }>;
}

/**
 * Bulk Delete Response DTO
 */
export class BulkDeleteResponseDto {
  deleted!: number;
  failed!: number;
  errors?: Array<{
    mediaId: string;
    error: string;
  }>;
}
