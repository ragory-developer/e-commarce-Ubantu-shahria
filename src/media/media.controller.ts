/**
 * src/media/media.controller.ts
 *
 * Enhanced media controller with production-ready endpoints
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
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

@ApiTags('Media Management')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  /**
   * ═══════════════════════════════════════════════════════════
   * UPLOAD ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Upload single file
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload a single file',
    description: 'Upload a single image or PDF file. Max 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    type: MediaResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: MediaResponseDto }> {
    try {
      const data = await this.mediaService.uploadSingle(file, user.id);
      this.logger.log(`File uploaded by user ${user.id}: ${data.id}`);
      return { message: 'File uploaded successfully', data };
    } catch (error) {
      this.logger.error('Upload failed', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  @Post('upload-multiple')
  @ApiOperation({
    summary: 'Upload multiple files',
    description: 'Upload up to 10 files in a single request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Files uploaded successfully',
    type: [MediaResponseDto],
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: MediaResponseDto[] }> {
    try {
      const data = await this.mediaService.uploadMultiple(files, user.id);
      this.logger.log(
        `Multiple files uploaded by user ${user.id}: ${data.length} files`,
      );
      return {
        message: `${data.length} files uploaded successfully`,
        data,
      };
    } catch (error) {
      this.logger.error('Multiple upload failed', error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * ENTITY LINKING ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * Link media to entity
   */
  @Post('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link media to entity',
    description:
      'Link one or more media files to a product, category, or other entity. ' +
      'Updates reference counts automatically.',
  })
  @ApiResponse({ status: 200, description: 'Media linked successfully' })
  async linkMediaToEntity(
    @Body() dto: LinkMediaToEntityDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: null }> {
    try {
      await this.mediaService.linkMediaToEntity(dto);
      this.logger.log(
        `User ${user.id} linked ${dto.mediaIds.length} media to ${dto.entityType}:${dto.entityId}`,
      );
      return { message: 'Media linked to entity successfully', data: null };
    } catch (error) {
      this.logger.error('Link media failed', error);
      throw error;
    }
  }

  /**
   * Update entity media
   */
  @Patch('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update entity media',
    description:
      'Replace existing media links for an entity. Updates positions and reference counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity media updated successfully',
  })
  async updateEntityMedia(
    @Body() dto: UpdateEntityMediaDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: null }> {
    try {
      await this.mediaService.updateEntityMedia(dto);
      this.logger.log(
        `User ${user.id} updated media for ${dto.entityType}:${dto.entityId}`,
      );
      return { message: 'Entity media updated successfully', data: null };
    } catch (error) {
      this.logger.error('Update entity media failed', error);
      throw error;
    }
  }

  /**
   * Reorder entity media
   */
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reorder entity media',
    description: 'Change the display order of media for an entity.',
  })
  @ApiResponse({ status: 200, description: 'Media reordered successfully' })
  async reorderEntityMedia(
    @Body() dto: ReorderEntityMediaDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: null }> {
    try {
      await this.mediaService.reorderEntityMedia(dto);
      this.logger.log(
        `User ${user.id} reordered media for ${dto.entityType}:${dto.entityId}`,
      );
      return { message: 'Media reordered successfully', data: null };
    } catch (error) {
      this.logger.error('Reorder media failed', error);
      throw error;
    }
  }

  /**
   * Get entity media (public endpoint)
   */
  @Post('entity-media')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get entity media',
    description:
      'Retrieve all media linked to an entity. Ordered by main flag and position.',
  })
  @ApiResponse({
    status: 200,
    description: 'Entity media retrieved',
    type: [EntityMediaResponseDto],
  })
  async getEntityMedia(
    @Body() dto: GetEntityMediaDto,
  ): Promise<{ message: string; data: EntityMediaResponseDto[] }> {
    try {
      const data = await this.mediaService.getEntityMedia(dto);
      return { message: 'Entity media retrieved', data };
    } catch (error) {
      this.logger.error('Get entity media failed', error);
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * MEDIA MANAGEMENT ENDPOINTS
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * List media with pagination
   */
  @Get()
  @ApiOperation({
    summary: 'List media',
    description: 'Get all media with pagination, filtering, and sorting.',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Number of records to skip',
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Number of records to return (max 100)',
  })
  @ApiQuery({
    name: 'mimeType',
    required: false,
    type: String,
    description: 'Filter by MIME type',
  })
  @ApiQuery({
    name: 'storageDriver',
    required: false,
    enum: ['local', 's3', 'cloudinary', 'gcs'],
    description: 'Filter by storage driver',
  })
  @ApiResponse({
    status: 200,
    description: 'Media list retrieved',
    type: PaginatedMediaResponseDto,
  })
  async listMedia(
    @Query() dto: ListMediaDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{
    message: string;
    data: MediaResponseDto[];
    meta: any;
  }> {
    try {
      const result = await this.mediaService.listMedia(dto);
      return {
        message: 'Media retrieved',
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      this.logger.error('List media failed', error);
      throw error;
    }
  }

  /**
   * Get single media by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get media by ID',
    description: 'Retrieve a single media file with usage information.',
  })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({
    status: 200,
    description: 'Media retrieved',
    type: MediaUsageDto,
  })
  async getMedia(
    @Param('id') id: string,
  ): Promise<{ message: string; data: MediaUsageDto }> {
    try {
      const data = await this.mediaService.getMedia(id);
      return { message: 'Media retrieved', data };
    } catch (error) {
      this.logger.error('Get media failed', error);
      throw error;
    }
  }

  /**
   * Update media metadata
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update media metadata',
    description: 'Update alt text and other metadata for a media file.',
  })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 200, description: 'Media metadata updated' })
  async updateMediaMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateMediaMetadataDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: null }> {
    try {
      dto.id = id; // Override with param ID
      await this.mediaService.updateMediaMetadata(dto);
      this.logger.log(`User ${user.id} updated metadata for media ${id}`);
      return { message: 'Media metadata updated', data: null };
    } catch (error) {
      this.logger.error('Update metadata failed', error);
      throw error;
    }
  }

  /**
   * Delete single media
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete media',
    description:
      'Soft delete a media file. Only possible if not in use (reference count = 0).',
  })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 200, description: 'Media deleted successfully' })
  async deleteMedia(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: null }> {
    try {
      await this.mediaService.deleteMedia(id, user.id);
      this.logger.log(`User ${user.id} deleted media ${id}`);
      return { message: 'Media deleted successfully', data: null };
    } catch (error) {
      this.logger.error('Delete media failed', error);
      throw error;
    }
  }

  /**
   * Bulk delete media
   */
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete media',
    description: 'Delete multiple media files in a single request.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed',
    type: BulkDeleteResponseDto,
  })
  async bulkDeleteMedia(
    @Body() dto: BulkDeleteMediaDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ message: string; data: BulkDeleteResponseDto }> {
    try {
      const data = await this.mediaService.bulkDeleteMedia(dto, user.id);
      this.logger.log(
        `User ${user.id} bulk deleted ${data.deleted} media (${data.failed} failed)`,
      );
      return {
        message: 'Bulk delete completed',
        data,
      };
    } catch (error) {
      this.logger.error('Bulk delete failed', error);
      throw error;
    }
  }
}
