// ─── src/media/media.controller.ts ───────────────────────────

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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
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
} from './dto';

@ApiTags('Media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ══════════════════════════════════════════════════════════════
  // UPLOAD ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single file' })
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.mediaService.uploadSingle(file, user.id);
    return { message: 'File uploaded successfully', data };
  }

  @Post('upload-multiple')
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
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
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.mediaService.uploadMultiple(files, user.id);
    return { message: `${data.length} files uploaded successfully`, data };
  }

  // ══════════════════════════════════════════════════════════════
  // ENTITY LINKING ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  @Post('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link media to entity (Product, Category, Brand, etc.)',
    description:
      'Creates entity_media records and increments media reference counts',
  })
  async linkMediaToEntity(@Body() dto: LinkMediaToEntityDto) {
    await this.mediaService.linkMediaToEntity(dto);
    return { message: 'Media linked to entity successfully', data: null };
  }

  @Patch('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update entity media (add/remove/reorder)',
    description:
      'Replaces existing links, updates reference counts, and sets main image',
  })
  async updateEntityMedia(@Body() dto: UpdateEntityMediaDto) {
    await this.mediaService.updateEntityMedia(dto);
    return { message: 'Entity media updated successfully', data: null };
  }

  @Post('entity-media')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all media for an entity (public endpoint)',
    description: 'Returns media ordered by isMain, then position',
  })
  async getEntityMedia(@Body() dto: GetEntityMediaDto) {
    const data = await this.mediaService.getEntityMedia(dto);
    return { message: 'Entity media retrieved', data };
  }

  // ══════════════════════════════════════════════════════════════
  // MEDIA MANAGEMENT ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  @Get()
  @ApiOperation({ summary: 'List all media with pagination and filters' })
  async listMedia(@Query() dto: ListMediaDto) {
    const result = await this.mediaService.listMedia(dto);
    return {
      message: 'Media retrieved',
      data: result.data,
      meta: {
        total: result.total,
        skip: dto.skip,
        take: dto.take,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single media by ID with usage information' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async getMedia(@Param('id') id: string) {
    const data = await this.mediaService.getMedia(id);
    return { message: 'Media retrieved', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete media (soft delete)',
    description: 'Only allowed if referenceCount is 0',
  })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async deleteMedia(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.mediaService.deleteMedia(id, user.id);
    return { message: 'Media deleted successfully', data: null };
  }
}
