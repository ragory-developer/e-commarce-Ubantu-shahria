/**
 * src/media/media.service.ts
 *
 * Enhanced media service with production-ready file handling,
 * entity linking, and validation
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import type { Express } from 'express';
import {
  LinkMediaToEntityDto,
  UpdateEntityMediaDto,
  GetEntityMediaDto,
  ListMediaDto,
  UpdateMediaMetadataDto,
  BulkDeleteMediaDto,
  ReorderEntityMediaDto,
  MediaResponseDto,
  EntityMediaResponseDto,
  PaginatedMediaResponseDto,
  MediaUsageDto,
  BulkDeleteResponseDto,
} from './dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly storageDriver: 'local' | 'cloudinary' | 's3' | 'gcs';
  private readonly localStoragePath: string;
  private readonly localBaseUrl: string;
  private readonly maxUploadSizeMB: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storageDriver = this.configService.get<string>(
      'STORAGE_DRIVER',
      'local',
    ) as 'local' | 'cloudinary' | 's3' | 'gcs';

    this.localStoragePath = this.configService.get<string>(
      'LOCAL_STORAGE_PATH',
      './storage/media',
    );

    this.localBaseUrl = this.configService.get<string>(
      'LOCAL_BASE_URL',
      'http://localhost:3001/uploads/media',
    );

    this.maxUploadSizeMB = this.configService.get<number>(
      'MAX_UPLOAD_SIZE_MB',
      10,
    );

    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
    ];

    // Initialize storage drivers
    if (this.storageDriver === 'cloudinary') {
      this.initializeCloudinary();
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * INITIALIZATION
   * ═══════════════════════════════════════════════════════════
   */

  private initializeCloudinary(): void {
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');
    if (cloudinaryUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl });
    } else {
      cloudinary.config({
        cloud_name: this.configService.getOrThrow('CLOUDINARY_CLOUD_NAME'),
        api_key: this.configService.getOrThrow('CLOUDINARY_API_KEY'),
        api_secret: this.configService.getOrThrow('CLOUDINARY_API_SECRET'),
      });
    }
    this.logger.log('Cloudinary initialized');
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * VALIDATION & SECURITY
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // File size validation
    const maxSizeBytes = this.maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum of ${this.maxUploadSizeMB}MB`,
      );
    }

    // MIME type validation
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Filename validation
    if (!file.originalname || file.originalname.length > 255) {
      throw new BadRequestException('Invalid filename');
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * UPLOAD OPERATIONS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Upload single file
   */
  async uploadSingle(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<MediaResponseDto> {
    this.validateFile(file);

    if (this.storageDriver === 'local') {
      return this.uploadToLocal(file, userId);
    } else if (this.storageDriver === 'cloudinary') {
      return this.uploadToCloudinary(file, userId);
    } else {
      throw new InternalServerErrorException(
        `Storage driver ${this.storageDriver} not implemented`,
      );
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    userId?: string,
  ): Promise<MediaResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed per request');
    }

    const results: MediaResponseDto[] = [];
    for (const file of files) {
      try {
        const result = await this.uploadSingle(file, userId);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to upload file: ${file.originalname}`, error);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Upload to local storage
   */
  private async uploadToLocal(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<MediaResponseDto> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      const filename = `${basename}_${timestamp}${ext}`;

      // Create date-based directory
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const uploadDir = path.join(this.localStoragePath, String(year), month);

      await fs.mkdir(uploadDir, { recursive: true });

      const filepath = path.join(uploadDir, filename);
      const url = `${this.localBaseUrl}/${year}/${month}/${filename}`;

      // Handle image files
      if (file.mimetype.startsWith('image/')) {
        const metadata = await sharp(file.buffer).metadata();
        const width = metadata.width;
        const height = metadata.height;

        // Save original
        await sharp(file.buffer).toFile(filepath);

        // Generate variants
        const variants: any = {
          original: { url, width, height },
        };

        // Thumbnail (150x150)
        const thumbFilename = `${basename}_${timestamp}_thumb${ext}`;
        const thumbPath = path.join(uploadDir, thumbFilename);
        const thumbUrl = `${this.localBaseUrl}/${year}/${month}/${thumbFilename}`;

        await sharp(file.buffer)
          .resize(150, 150, { fit: 'cover' })
          .toFile(thumbPath);

        variants.thumb = { url: thumbUrl, width: 150, height: 150 };

        // Medium (600x600)
        const mediumFilename = `${basename}_${timestamp}_medium${ext}`;
        const mediumPath = path.join(uploadDir, mediumFilename);
        const mediumUrl = `${this.localBaseUrl}/${year}/${month}/${mediumFilename}`;

        await sharp(file.buffer)
          .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
          .toFile(mediumPath);

        const mediumMetadata = await sharp(mediumPath).metadata();
        variants.medium = {
          url: mediumUrl,
          width: mediumMetadata.width,
          height: mediumMetadata.height,
        };

        // Save to database
        const media = await this.prisma.media.create({
          data: {
            filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            extension: ext,
            storageDriver: 'local',
            storagePath: filepath,
            storageUrl: url,
            variants,
            width,
            height,
            createdBy: userId,
          },
        });

        this.logger.log(`Local upload successful: ${media.id}`);
        return this.mapMediaToDto(media);
      } else {
        // Non-image files (PDF, etc.)
        await fs.writeFile(filepath, file.buffer);

        const media = await this.prisma.media.create({
          data: {
            filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            extension: ext,
            storageDriver: 'local',
            storagePath: filepath,
            storageUrl: url,
            createdBy: userId,
          },
        });

        this.logger.log(`Local upload successful: ${media.id}`);
        return this.mapMediaToDto(media);
      }
    } catch (error) {
      this.logger.error('Local upload failed', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Upload to Cloudinary
   */
  private async uploadToCloudinary(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<MediaResponseDto> {
    try {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'media',
            resource_type: 'auto',
            eager: [
              { width: 150, height: 150, crop: 'thumb' },
              { width: 600, height: 600, crop: 'limit' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        uploadStream.end(file.buffer);
      });

      // Build variants
      const variants: any = {
        original: {
          url: uploadResult.secure_url,
          width: uploadResult.width,
          height: uploadResult.height,
        },
      };

      if (uploadResult.eager && uploadResult.eager.length > 0) {
        variants.thumb = {
          url: uploadResult.eager[0].secure_url,
          width: 150,
          height: 150,
        };

        if (uploadResult.eager[1]) {
          variants.medium = {
            url: uploadResult.eager[1].secure_url,
            width: uploadResult.eager[1].width,
            height: uploadResult.eager[1].height,
          };
        }
      }

      const media = await this.prisma.media.create({
        data: {
          filename: uploadResult.public_id,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          extension: path.extname(file.originalname),
          storageDriver: 'cloudinary',
          storagePath: uploadResult.public_id,
          storageUrl: uploadResult.secure_url,
          variants,
          width: uploadResult.width,
          height: uploadResult.height,
          createdBy: userId,
        },
      });

      this.logger.log(`Cloudinary upload successful: ${media.id}`);
      return this.mapMediaToDto(media);
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new InternalServerErrorException(
        'Failed to upload file to Cloudinary',
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * ENTITY LINKING
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Link media to entity
   */
  async linkMediaToEntity(dto: LinkMediaToEntityDto): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Verify all media exist
      const media = await tx.media.findMany({
        where: {
          id: { in: dto.mediaIds },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (media.length !== dto.mediaIds.length) {
        throw new NotFoundException('One or more media not found');
      }

      // Create entity_media links
      const links = dto.mediaIds.map((mediaId, index) => ({
        entityType: dto.entityType,
        entityId: dto.entityId,
        mediaId,
        position: index,
        purpose: dto.purpose,
        isMain: dto.mainMediaId === mediaId,
      }));

      await tx.entityMedia.createMany({
        data: links,
        skipDuplicates: true,
      });

      // Increment reference counts
      await tx.media.updateMany({
        where: { id: { in: dto.mediaIds } },
        data: { referenceCount: { increment: 1 } },
      });

      this.logger.log(
        `Linked ${dto.mediaIds.length} media to ${dto.entityType}:${dto.entityId}`,
      );
    });
  }

  /**
   * Update entity media
   */
  async updateEntityMedia(dto: UpdateEntityMediaDto): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Get existing links
      const existing = await tx.entityMedia.findMany({
        where: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          ...(dto.purpose && { purpose: dto.purpose }),
        },
        select: { id: true, mediaId: true },
      });

      const existingMediaIds = existing.map((e) => e.mediaId);

      // Determine what to add and remove
      const toAdd = dto.mediaIds.filter((id) => !existingMediaIds.includes(id));
      const toRemove = existingMediaIds.filter(
        (id) => !dto.mediaIds.includes(id),
      );

      // Remove old links
      if (toRemove.length > 0) {
        await tx.entityMedia.deleteMany({
          where: {
            entityType: dto.entityType,
            entityId: dto.entityId,
            mediaId: { in: toRemove },
          },
        });

        // Decrement reference counts
        await tx.media.updateMany({
          where: { id: { in: toRemove } },
          data: { referenceCount: { decrement: 1 } },
        });
      }

      // Add new links
      if (toAdd.length > 0) {
        const newLinks = toAdd.map((mediaId, index) => ({
          entityType: dto.entityType,
          entityId: dto.entityId,
          mediaId,
          position: existingMediaIds.length + index,
          purpose: dto.purpose,
          isMain: dto.mainMediaId === mediaId,
        }));

        await tx.entityMedia.createMany({
          data: newLinks,
          skipDuplicates: true,
        });

        // Increment reference counts
        await tx.media.updateMany({
          where: { id: { in: toAdd } },
          data: { referenceCount: { increment: 1 } },
        });
      }

      // Update isMain flag
      if (dto.mainMediaId) {
        await tx.entityMedia.updateMany({
          where: {
            entityType: dto.entityType,
            entityId: dto.entityId,
          },
          data: { isMain: false },
        });

        await tx.entityMedia.updateMany({
          where: {
            entityType: dto.entityType,
            entityId: dto.entityId,
            mediaId: dto.mainMediaId,
          },
          data: { isMain: true },
        });
      }

      this.logger.log(
        `Updated media for ${dto.entityType}:${dto.entityId} (added: ${toAdd.length}, removed: ${toRemove.length})`,
      );
    });
  }

  /**
   * Get entity media
   */
  async getEntityMedia(
    dto: GetEntityMediaDto,
  ): Promise<EntityMediaResponseDto[]> {
    const links = await this.prisma.entityMedia.findMany({
      where: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        ...(dto.purpose && { purpose: dto.purpose }),
      },
      include: {
        media: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            extension: true,
            storageDriver: true,
            storageUrl: true,
            variants: true,
            width: true,
            height: true,
            alt: true,
            referenceCount: true,
            createdAt: true,
            updatedAt: true,
            createdBy: true,
          },
        },
      },
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });

    return links.map((link) => ({
      ...this.mapMediaToDto(link.media as any),
      purpose: link.purpose,
      position: link.position,
      isMain: link.isMain,
    }));
  }

  /**
   * Reorder entity media
   */
  async reorderEntityMedia(dto: ReorderEntityMediaDto): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Update positions
      const updates = dto.orderedMediaIds.map((mediaId, index) =>
        tx.entityMedia.update({
          where: {
            entityType_entityId_mediaId: {
              entityType: dto.entityType,
              entityId: dto.entityId,
              mediaId,
            },
          },
          data: { position: index },
        }),
      );

      await Promise.all(updates);

      this.logger.log(`Reordered media for ${dto.entityType}:${dto.entityId}`);
    });
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * MEDIA MANAGEMENT
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * List media with pagination
   */
  async listMedia(dto: ListMediaDto): Promise<PaginatedMediaResponseDto> {
    const where = {
      deletedAt: null,
      ...(dto.mimeType && { mimeType: { contains: dto.mimeType } }),
      ...(dto.storageDriver && { storageDriver: dto.storageDriver }),
    };

    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          extension: true,
          storageDriver: true,
          storageUrl: true,
          variants: true,
          width: true,
          height: true,
          alt: true,
          referenceCount: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
        },
        orderBy: {
          [dto.sortOrder === 'asc' ? 'createdAt' : 'createdAt']:
            dto.sortOrder || 'desc',
        },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      data: data.map((m) => this.mapMediaToDto(m as any)),
      meta: {
        total,
        skip: dto.skip,
        take: dto.take,
        hasMore: dto.skip + dto.take < total,
      },
    };
  }

  /**
   * Get single media by ID
   */
  async getMedia(id: string): Promise<MediaUsageDto> {
    const media = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      include: {
        entityMedia: {
          select: {
            entityType: true,
            entityId: true,
            purpose: true,
            isMain: true,
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return {
      id: media.id,
      referenceCount: media.referenceCount,
      usage: media.entityMedia.map((em) => ({
        entityType: em.entityType,
        entityId: em.entityId,
        purpose: em.purpose,
        isMain: em.isMain,
      })),
    };
  }

  /**
   * Update media metadata
   */
  async updateMediaMetadata(dto: UpdateMediaMetadataDto): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id: dto.id, deletedAt: null },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    await this.prisma.media.update({
      where: { id: dto.id },
      data: {
        alt: dto.alt,
      },
    });

    this.logger.log(`Updated metadata for media: ${dto.id}`);
  }

  /**
   * Delete single media
   */
  async deleteMedia(id: string, deletedBy?: string): Promise<void> {
    const media = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, referenceCount: true },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.referenceCount > 0) {
      throw new BadRequestException(
        'Cannot delete media that is currently in use. Remove all references first.',
      );
    }

    await this.prisma.softDelete('media', id, deletedBy);
    this.logger.log(`Media ${id} soft deleted`);
  }

  /**
   * Bulk delete media
   */
  async bulkDeleteMedia(
    dto: BulkDeleteMediaDto,
    deletedBy?: string,
  ): Promise<BulkDeleteResponseDto> {
    const errors: Array<{ mediaId: string; error: string }> = [];
    let deleted = 0;

    for (const mediaId of dto.mediaIds) {
      try {
        const media = await this.prisma.media.findFirst({
          where: { id: mediaId, deletedAt: null },
        });

        if (!media) {
          errors.push({ mediaId, error: 'Media not found' });
          continue;
        }

        if (media.referenceCount > 0 && !dto.force) {
          errors.push({
            mediaId,
            error: 'Media is in use. Use force: true to override.',
          });
          continue;
        }

        await this.prisma.softDelete('media', mediaId, deletedBy);
        deleted++;
      } catch (error) {
        errors.push({
          mediaId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk deleted ${deleted} media files (${errors.length} failed)`,
    );

    return {
      deleted,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * HELPER FUNCTIONS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Map Media model to DTO
   */
  private mapMediaToDto(media: any): MediaResponseDto {
    return {
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      extension: media.extension,
      storageDriver: media.storageDriver,
      storageUrl: media.storageUrl,
      variants: media.variants,
      width: media.width,
      height: media.height,
      alt: media.alt,
      referenceCount: media.referenceCount,
      createdAt: media.createdAt,
      updatedAt: media.updatedAt,
      createdBy: media.createdBy,
    };
  }
}
