// ─── src/media/media.service.ts ──────────────────────────────

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
  UploadMediaDto,
  LinkMediaToEntityDto,
  UpdateEntityMediaDto,
  GetEntityMediaDto,
  ListMediaDto,
} from './dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly storageDriver: 'local' | 'cloudinary';
  private readonly localStoragePath: string;
  private readonly localBaseUrl: string;
  private readonly maxUploadSizeMB: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storageDriver = this.configService.get<string>(
      'STORAGE_DRIVER',
      'local',
    ) as 'local' | 'cloudinary';
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

    // Initialize Cloudinary if selected
    if (this.storageDriver === 'cloudinary') {
      const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');
      if (cloudinaryUrl) {
        // If CLOUDINARY_URL exists, let cloudinary parse it
        cloudinary.config({ cloudinary_url: cloudinaryUrl });
      } else {
        cloudinary.config({
          cloud_name: this.configService.getOrThrow('CLOUDINARY_CLOUD_NAME'),
          api_key: this.configService.getOrThrow('CLOUDINARY_API_KEY'),
          api_secret: this.configService.getOrThrow('CLOUDINARY_API_SECRET'),
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // UPLOAD OPERATIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * Upload a single file
   */
  async uploadSingle(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<object> {
    this.validateFile(file);

    if (this.storageDriver === 'local') {
      return this.uploadToLocal(file, userId);
    } else {
      return this.uploadToCloudinary(file, userId);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    userId?: string,
  ): Promise<object[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed per request');
    }

    const results: object[] = [];
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

  // ══════════════════════════════════════════════════════════════
  // ENTITY LINKING
  // ══════════════════════════════════════════════════════════════

  /**
   * Link media to entity (Product, Category, Brand, etc.)
   * Updates reference counts in transaction
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
   * Update entity media (add/remove/reorder)
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

      // Determine what to add and what to remove
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

      // Update isMain flag if specified
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
   * Get all media for an entity
   */
  async getEntityMedia(dto: GetEntityMediaDto): Promise<object[]> {
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
            storageUrl: true,
            variants: true,
            width: true,
            height: true,
            alt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });

    return links.map((link) => ({
      ...link.media,
      purpose: link.purpose,
      position: link.position,
      isMain: link.isMain,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // MEDIA MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  /**
   * List all media with pagination
   */
  async listMedia(
    dto: ListMediaDto,
  ): Promise<{ data: object[]; total: number }> {
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
          storageDriver: true,
          storageUrl: true,
          variants: true,
          width: true,
          height: true,
          referenceCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.media.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Get single media by ID with usage information
   */
  async getMedia(id: string): Promise<object> {
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

    return media;
  }

  /**
   * Delete media (soft delete)
   * Only allows deletion if referenceCount is 0
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

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Size check
    const maxSizeBytes = this.maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum of ${this.maxUploadSizeMB}MB`,
      );
    }

    // MIME type check
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private async uploadToLocal(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<object> {
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

      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });

      const filepath = path.join(uploadDir, filename);
      const url = `${this.localBaseUrl}/${year}/${month}/${filename}`;

      // Get image dimensions
      let width: number | undefined;
      let height: number | undefined;

      if (file.mimetype.startsWith('image/')) {
        const metadata = await sharp(file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;

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
        return media;
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
        return media;
      }
    } catch (error) {
      this.logger.error('Local upload failed', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<object> {
    try {
      // Upload to Cloudinary
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

      // Save to database
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
      return media;
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new InternalServerErrorException(
        'Failed to upload file to Cloudinary',
      );
    }
  }
}
