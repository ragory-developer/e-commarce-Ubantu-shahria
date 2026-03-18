// ─── src/product/product.controller.ts ────────────────────────

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ListProductsDto,
  BulkEditVariantDto,
  UpdateVariantDto,
  CreateReviewDto,
  AdminReviewReplyDto,
  ListReviewsDto,
  CreateQuestionDto,
  CreateAnswerDto,
  ListQuestionsDto,
  AddProductMediaDto,
  ReplaceProductMediaDto,
  ReorderProductMediaDto,
  SetMainMediaDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UserType } from '../common/decorators/user-type.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { AdminPermission } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AdjustStockDto {
  @ApiProperty({
    example: 10,
    description: 'Quantity to add (positive) or remove (negative)',
  })
  @Type(() => Number)
  @IsNumber()
  qtyChange!: number;

  @ApiProperty({
    example: 'MANUAL_ADJUSTMENT',
    enum: [
      'INITIAL_STOCK',
      'MANUAL_ADJUSTMENT',
      'RESTOCK',
      'DAMAGED',
      'RETURNED',
    ],
  })
  @IsString()
  @IsIn([
    'INITIAL_STOCK',
    'MANUAL_ADJUSTMENT',
    'RESTOCK',
    'DAMAGED',
    'RETURNED',
  ])
  reason!: string;

  @ApiPropertyOptional({ example: 'Received new shipment from supplier' })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ══════════════════════════════════════════════════════════════
  // ─── PRODUCT CRUD ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Post()
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiOperation({
    summary: 'Create product with all relations in one payload',
    description:
      'Creates a product along with variations, variants, categories, tags, attributes, ' +
      'and media links. For variant products, provide "variations" (defines the option types, e.g. Size) ' +
      'and "variants" (concrete combinations, e.g. "S / Red"). ' +
      'For simple products, provide price/sku/qty at the top level.',
  })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 409, description: 'SKU already exists' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.create(dto, user.id);
    return { message: 'Product created successfully', data };
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List products with filters, pagination, and optional full detail',
    description:
      'Returns paginated products. Use ?detail=true for full data (same as GET /products/:id). ' +
      'Summary mode includes media, brand, categories, tags, and top-10 variants.',
  })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  async findAll(@Query() dto: ListProductsDto) {
    const result = await this.productService.findAll(dto);
    return {
      message: 'Products retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
    };
  }

  @Get('search')
  @Public()
  @ApiOperation({ summary: 'Search products for dropdown / autocomplete' })
  @ApiQuery({ name: 'q', required: true, example: 'cotton shirt' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    const data = await this.productService.search(
      q,
      limit ? parseInt(limit) : 20,
    );
    return { message: 'Search results', data };
  }

  @Get('slug/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'classic-cotton-t-shirt' })
  @ApiOperation({
    summary: 'Get product by slug (SEO-friendly URL)',
    description:
      'Returns full product data. Used for storefront product detail pages.',
  })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.productService.findBySlug(slug);
    return { message: 'Product retrieved', data };
  }

  @Get('category/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'mens-clothing' })
  @ApiOperation({
    summary: 'Get products by category slug',
    description:
      'Supports all same query params as GET /products. Returns category info too.',
  })
  async findByCategorySlug(
    @Param('slug') slug: string,
    @Query() dto: ListProductsDto,
  ) {
    const result = await this.productService.findByCategorySlug(slug, dto);
    return {
      message: 'Products retrieved',
      data: result.data,
      meta: result.meta,
      total: result.total,
      category: (result as any).category,
    };
  }

  @Get(':id')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get product by ID with all relations and media' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.productService.findOne(id);
    return { message: 'Product retrieved', data };
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Update product. Only provided fields are changed.',
  })
  @ApiResponse({ status: 200, description: 'Product updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.update(id, dto, user.id);
    return { message: 'Product updated', data };
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soft delete product and all its variants' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.productService.remove(id, user.id);
    return { message: 'Product deleted', data: null };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── MEDIA MANAGEMENT ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Get(':id/media')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Get all media for a product',
    description:
      'Returns ordered list of all media (images) linked to this product.',
  })
  async getProductMedia(@Param('id') id: string) {
    const data = await this.productService.getProductMedia(id);
    return { message: 'Product media retrieved', data };
  }

  @Post(':id/media')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Add media to product (append)',
    description:
      'Appends new media to the product. Existing media is preserved. ' +
      'Pass mainMediaId to set the primary/thumbnail image.',
  })
  async addProductMedia(
    @Param('id') id: string,
    @Body() dto: AddProductMediaDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.addProductMedia(id, dto);
    return { message: 'Media added to product', data };
  }

  @Patch(':id/media')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Replace all product media',
    description:
      'Completely replaces product media. Media not in the new list will be unlinked ' +
      '(reference count decremented). Order in the array determines display order.',
  })
  async replaceProductMedia(
    @Param('id') id: string,
    @Body() dto: ReplaceProductMediaDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.replaceProductMedia(id, dto);
    return { message: 'Product media replaced', data };
  }

  @Patch(':id/media/reorder')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Reorder product images' })
  async reorderProductMedia(
    @Param('id') id: string,
    @Body() dto: ReorderProductMediaDto,
  ) {
    const data = await this.productService.reorderProductMedia(id, dto);
    return { message: 'Media reordered', data };
  }

  @Patch(':id/media/main')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Set the main/thumbnail image for a product' })
  async setMainMedia(@Param('id') id: string, @Body() dto: SetMainMediaDto) {
    const data = await this.productService.setMainMedia(id, dto);
    return { message: 'Main image updated', data };
  }

  @Delete(':id/media/:mediaId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'mediaId' })
  @ApiOperation({ summary: 'Remove a specific image from product' })
  async removeProductMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    const data = await this.productService.removeProductMedia(id, mediaId);
    return { message: 'Media removed from product', data };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── VARIANT MANAGEMENT ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Patch(':id/variants/bulk')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Bulk edit all variants of a product',
    description: 'Set the same field value across ALL active variants.',
  })
  async bulkEditVariants(
    @Param('id') id: string,
    @Body() dto: BulkEditVariantDto,
  ) {
    const data = await this.productService.bulkEditVariants(id, dto);
    return { message: 'All variants updated', data };
  }

  @Patch(':id/variants/:variantId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiOperation({ summary: 'Update a single variant' })
  async updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.updateVariant(
      id,
      variantId,
      dto,
      user.id,
    );
    return { message: 'Variant updated', data };
  }

  @Delete(':id/variants/:variantId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiOperation({ summary: 'Soft delete a specific variant' })
  async deleteVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.deleteVariant(
      id,
      variantId,
      user.id,
    );
    return { message: 'Variant deleted', data };
  }

  // ─── Variant Media ────────────────────────────────────────────

  @Post(':id/variants/:variantId/media')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiOperation({ summary: 'Add images to a variant' })
  async addVariantMedia(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: AddProductMediaDto,
  ) {
    const data = await this.productService.addVariantMedia(id, variantId, dto);
    return { message: 'Media added to variant', data };
  }

  @Patch(':id/variants/:variantId/media')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiOperation({ summary: 'Replace all images for a variant' })
  async replaceVariantMedia(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: ReplaceProductMediaDto,
  ) {
    const data = await this.productService.replaceVariantMedia(
      id,
      variantId,
      dto,
    );
    return { message: 'Variant media replaced', data };
  }

  @Delete(':id/variants/:variantId/media/:mediaId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.MANAGE_PRODUCTS)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiParam({ name: 'mediaId' })
  @ApiOperation({ summary: 'Remove a specific image from variant' })
  async removeVariantMedia(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Param('mediaId') mediaId: string,
  ) {
    const data = await this.productService.removeVariantMedia(
      id,
      variantId,
      mediaId,
    );
    return { message: 'Media removed from variant', data };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── REVIEWS ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Get(':id/reviews')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'List product reviews (approved)',
    description:
      'Returns approved reviews with rating distribution. Admin can pass ?isApproved=false to see pending.',
  })
  async listReviews(@Param('id') id: string, @Query() dto: ListReviewsDto) {
    const data = await this.productService.listReviews(id, dto);
    return { message: 'Reviews retrieved', data };
  }

  @Post(':id/reviews')
  @ApiBearerAuth('access-token')
  @UserType('CUSTOMER')
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Submit a review for a product',
    description:
      'Customer must be authenticated. Reviews require admin approval before appearing publicly.',
  })
  @ApiResponse({ status: 201, description: 'Review submitted' })
  async createReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.createReview(id, dto, user.id);
    return { message: 'Review submitted. Awaiting approval.', data };
  }

  @Post(':id/reviews/guest')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Submit a guest review (no auth required)',
    description: 'Guest reviews always require admin approval.',
  })
  async createGuestReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.productService.createReview(id, dto);
    return { message: 'Review submitted. Awaiting approval.', data };
  }

  @Patch(':id/reviews/:reviewId/approve')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'reviewId' })
  @ApiOperation({ summary: '[Admin] Approve a pending review' })
  async approveReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.approveReview(reviewId, user.id);
    return { message: 'Review approved', data };
  }

  @Delete(':id/reviews/:reviewId')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'reviewId' })
  @ApiOperation({ summary: '[Admin] Reject / remove a review' })
  async rejectReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.rejectReview(reviewId, user.id);
    return { message: 'Review rejected', data };
  }

  @Post(':id/reviews/:reviewId/reply')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'reviewId' })
  @ApiOperation({ summary: '[Admin] Reply to a review' })
  async replyToReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminReviewReplyDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.replyToReview(
      reviewId,
      dto,
      user.id,
    );
    return { message: 'Reply added', data };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── QUESTIONS & ANSWERS ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Get(':id/questions')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'List published Q&A for a product',
    description: 'Returns published questions with their approved answers.',
  })
  async listQuestions(@Param('id') id: string, @Query() dto: ListQuestionsDto) {
    const data = await this.productService.listQuestions(id, dto);
    return { message: 'Questions retrieved', data };
  }

  @Get(':id/questions/admin')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_READ)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: '[Admin] List all questions including unpublished' })
  async listQuestionsAdmin(
    @Param('id') id: string,
    @Query() dto: ListQuestionsDto,
  ) {
    const data = await this.productService.listQuestions(id, dto, true);
    return { message: 'Questions retrieved', data };
  }

  @Post(':id/questions')
  @Public()
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Submit a product question',
    description:
      'Questions require admin publishing before appearing publicly.',
  })
  async createQuestion(
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    const data = await this.productService.createQuestion(id, dto);
    return { message: 'Question submitted. Awaiting review.', data };
  }

  @Post(':id/questions/:questionId/publish')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionId' })
  @ApiOperation({ summary: '[Admin] Publish a question' })
  async publishQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    const data = await this.productService.publishQuestion(questionId);
    return { message: 'Question published', data };
  }

  @Post(':id/questions/:questionId/answer')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_UPDATE)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'questionId' })
  @ApiOperation({ summary: '[Admin] Answer a product question' })
  async answerQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: CreateAnswerDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.answerQuestion(
      questionId,
      dto,
      user.id,
    );
    return { message: 'Answer submitted', data };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── INVENTORY ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Get(':id/inventory')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.INVENTORY_VIEW)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: '[Admin] Get inventory status for product and all variants',
    description:
      'Shows current qty, reserved qty, available qty, and low stock warnings.',
  })
  async getInventory(@Param('id') id: string) {
    const data = await this.productService.getInventory(id);
    return { message: 'Inventory retrieved', data };
  }

  @Post(':id/inventory/adjust')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.INVENTORY_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: '[Admin] Adjust product stock quantity',
    description:
      'Use positive qtyChange to add stock, negative to remove. Logs the change.',
  })
  async adjustProductStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.adjustStock(
      id,
      null,
      dto.qtyChange,
      dto.reason,
      user.id,
      dto.notes,
    );
    return { message: 'Stock adjusted', data };
  }

  @Post(':id/variants/:variantId/inventory/adjust')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.INVENTORY_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'variantId' })
  @ApiOperation({ summary: '[Admin] Adjust variant stock quantity' })
  async adjustVariantStock(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: RequestUser,
  ) {
    const data = await this.productService.adjustStock(
      id,
      variantId,
      dto.qtyChange,
      dto.reason,
      user.id,
      dto.notes,
    );
    return { message: 'Variant stock adjusted', data };
  }

  @Get(':id/inventory/logs')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.INVENTORY_VIEW)
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiOperation({ summary: '[Admin] Get inventory change history' })
  async getInventoryLogs(
    @Param('id') id: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const data = await this.productService.getInventoryLogs(
      id,
      parseInt(skip ?? '0'),
      parseInt(take ?? '20'),
    );
    return { message: 'Inventory logs retrieved', data };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── PRICE HISTORY ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  @Get(':id/price-history')
  @ApiBearerAuth('access-token')
  @UserType('ADMIN')
  @Permissions(AdminPermission.PRODUCT_READ)
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiOperation({ summary: '[Admin] Get price change history' })
  async getPriceHistory(
    @Param('id') id: string,
    @Query('variantId') variantId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const data = await this.productService.getPriceHistory(
      id,
      variantId,
      parseInt(skip ?? '0'),
      parseInt(take ?? '20'),
    );
    return { message: 'Price history retrieved', data };
  }
}
