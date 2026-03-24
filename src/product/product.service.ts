// ─── src/product/product.service.ts ───────────────────────────

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
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
import { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180);
}

function toDecimal(value: number | undefined | null): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

// ─── Prisma include shapes ─────────────────────────────────────

const MEDIA_INCLUDE = {
  media: {
    select: {
      id: true,
      storageUrl: true,
      variants: true,
      alt: true,
      mimeType: true,
      width: true,
      height: true,
      originalName: true,
    },
  },
};

const PRODUCT_FULL_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true, image: true } },
  taxClass: { select: { id: true, name: true, basedOn: true } },
  categories: {
    where: { category: { deletedAt: null } },
    include: {
      category: { select: { id: true, name: true, slug: true, path: true } },
    },
    orderBy: { isPrimary: 'desc' as const },
  },
  tags: {
    include: { tag: { select: { id: true, name: true, slug: true } } },
  },
  attributes: {
    include: {
      attribute: { select: { id: true, name: true, slug: true, type: true } },
      values: {
        include: {
          attributeValue: {
            select: { id: true, value: true, label: true, hexColor: true },
          },
        },
      },
    },
  },
  variations: {
    include: {
      variation: {
        select: {
          id: true,
          uid: true,
          name: true,
          type: true,
          isGlobal: true,
          values: {
            where: { deletedAt: null },
            select: {
              id: true,
              uid: true,
              label: true,
              value: true,
              position: true,
            },
            orderBy: { position: 'asc' as const },
          },
        },
      },
    },
  },
  variants: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      uid: true,
      uids: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      specialPrice: true,
      specialPriceType: true,
      specialPriceStart: true,
      specialPriceEnd: true,
      manageStock: true,
      qty: true,
      reservedQty: true,
      inStock: true,
      lowStockThreshold: true,
      weight: true,
      isDefault: true,
      isActive: true,
      position: true,
      images: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  relatedTo: {
    include: {
      relatedProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
          specialPrice: true,
        },
      },
    },
    orderBy: { position: 'asc' as const },
  },
  upSellTo: {
    include: {
      upSellProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
          specialPrice: true,
        },
      },
    },
    orderBy: { position: 'asc' as const },
  },
  crossSellTo: {
    include: {
      crossSellProduct: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: true,
          price: true,
          specialPrice: true,
        },
      },
    },
    orderBy: { position: 'asc' as const },
  },
  _count: {
    select: {
      reviews: { where: { isApproved: true, deletedAt: null } },
      questions: { where: { isPublished: true, deletedAt: null } },
      variants: { where: { deletedAt: null } },
    },
  },
} as const;

const PRODUCT_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  sku: true,
  price: true,
  specialPrice: true,
  specialPriceType: true,
  specialPriceStart: true,
  specialPriceEnd: true,
  minPrice: true,
  maxPrice: true,
  images: true,
  inStock: true,
  isActive: true,
  isFeatured: true,
  averageRating: true,
  reviewCount: true,
  newFrom: true,
  newTo: true,
  viewed: true,
  createdAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  categories: {
    where: { category: { deletedAt: null } },
    select: {
      category: { select: { id: true, name: true, slug: true } },
      isPrimary: true,
    },
    orderBy: { isPrimary: 'desc' as const },
  },
  tags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
  },
  variants: {
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      uid: true,
      name: true,
      sku: true,
      price: true,
      specialPrice: true,
      specialPriceType: true,
      inStock: true,
      isDefault: true,
      isActive: true,
      position: true,
      qty: true,
    },
    orderBy: { position: 'asc' as const },
    take: 10,
  },
  _count: {
    select: {
      variants: { where: { deletedAt: null } },
      reviews: { where: { isApproved: true, deletedAt: null } },
    },
  },
};

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  // ─── Generate unique slug ────────────────────────────────────
  private async generateUniqueSlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = slugify(name);
    if (!slug) slug = 'product';
    let candidate = slug;
    let counter = 0;
    while (true) {
      const where: any = { slug: candidate, deletedAt: null };
      if (excludeId) where.id = { not: excludeId };
      const exists = await this.prisma.product.findFirst({
        where,
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${slug}-${++counter}`;
    }
  }

  // ─── Build Prisma orderBy ────────────────────────────────────
  private buildOrderBy(
    sortBy?: string,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'oldest':
        return { createdAt: 'asc' };
      case 'price_asc':
        return { price: 'asc' };
      case 'price_desc':
        return { price: 'desc' };
      case 'name_asc':
        return { name: 'asc' };
      case 'name_desc':
        return { name: 'desc' };
      case 'popular':
        return { viewed: 'desc' };
      case 'rating':
        return { averageRating: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  }

  // ─── Attach media from EntityMedia table ─────────────────────
  // private async attachMedia(product: any): Promise<any> {
  //   const [media, entityMediaLinks] = await Promise.all([
  //     this.prisma.entityMedia.findMany({
  //       where: { entityType: 'Product', entityId: product.id },
  //       include: MEDIA_INCLUDE,
  //       orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
  //     }),
  //     Promise.resolve([]),
  //   ]);

  //   const variantsWithMedia = await Promise.all(
  //     (product.variants || []).map(async (variant: any) => {
  //       const variantMedia = await this.prisma.entityMedia.findMany({
  //         where: { entityType: 'ProductVariant', entityId: variant.id },
  //         include: MEDIA_INCLUDE,
  //         orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
  //       });
  //       return { ...variant, media: variantMedia };
  //     }),
  //   );

  //   return { ...product, media, variants: variantsWithMedia };
  // }
  private async attachMedia(product: any): Promise<any> {
    // Collect all entity IDs we need media for
    const variantIds: string[] = (product.variants || []).map((v: any) => v.id);
    const allEntityIds = [product.id, ...variantIds];

    // ── SINGLE QUERY for all media (product + all variants) ──────
    const allMedia = await this.prisma.entityMedia.findMany({
      where: {
        entityId: { in: allEntityIds },
        entityType: { in: ['Product', 'ProductVariant'] },
      },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
            mimeType: true,
            width: true,
            height: true,
            originalName: true,
          },
        },
      },
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });

    // Split into product media vs variant media (group by entityId)
    const productMedia = allMedia.filter(
      (m) => m.entityType === 'Product' && m.entityId === product.id,
    );

    const variantMediaMap = new Map<string, typeof allMedia>();
    for (const m of allMedia.filter((m) => m.entityType === 'ProductVariant')) {
      const list = variantMediaMap.get(m.entityId) ?? [];
      list.push(m);
      variantMediaMap.set(m.entityId, list);
    }

    // Attach media to each variant
    const variantsWithMedia = (product.variants || []).map((variant: any) => ({
      ...variant,
      media: variantMediaMap.get(variant.id) ?? [],
    }));

    return {
      ...product,
      media: productMedia,
      variants: variantsWithMedia,
    };
  }

  // ─── Recompute product price range from variants ──────────────
  private async recomputePriceRange(productId: string): Promise<void> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null, isActive: true },
      select: { price: true, specialPrice: true },
    });

    if (variants.length === 0) return;

    const prices = variants
      .map((v) => {
        const base = v.price?.toNumber() ?? null;
        const sale = v.specialPrice?.toNumber() ?? null;
        return sale !== null && sale < (base ?? Infinity) ? sale : base;
      })
      .filter((p): p is number => p !== null);

    if (prices.length === 0) return;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        minPrice: new Prisma.Decimal(minPrice),
        maxPrice: new Prisma.Decimal(maxPrice),
      },
    });
  }

  // ─── Recompute average rating ─────────────────────────────────
  private async recomputeRating(productId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: { productId, isApproved: true, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating: result._avg.rating
          ? new Prisma.Decimal(result._avg.rating.toFixed(2))
          : null,
        reviewCount: result._count.rating,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE PRODUCT
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateProductDto, createdBy: string) {
    const slug = await this.generateUniqueSlug(dto.name);
    const hasVariants = !!dto.variants?.length;

    // ─── SKU uniqueness checks ──────────────────────────────────
    if (!hasVariants && dto.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { sku: dto.sku, deletedAt: null },
        select: { id: true },
      });
      if (skuExists)
        throw new ConflictException('Product with this SKU already exists');
    }

    if (hasVariants && dto.variants) {
      for (const v of dto.variants) {
        if (v.sku) {
          const skuExists = await this.prisma.productVariant.findFirst({
            where: { sku: v.sku, deletedAt: null },
            select: { id: true },
          });
          if (skuExists)
            throw new ConflictException(
              `Variant SKU "${v.sku}" already exists`,
            );
        }
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      // ─── 1. Create Product ──────────────────────────────────
      const created = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          shortDescription: dto.shortDescription ?? null,
          brandId: dto.brandId ?? null,
          taxClassId: dto.taxClassId ?? null,
          isActive: dto.isActive ?? true,
          isFeatured: dto.isFeatured ?? false,

          // Global pricing — only when NO variants
          price: !hasVariants ? toDecimal(dto.price) : null,
          specialPrice: !hasVariants ? toDecimal(dto.specialPrice) : null,
          specialPriceType:
            !hasVariants && dto.specialPriceType ? dto.specialPriceType : null,
          specialPriceStart:
            !hasVariants && dto.specialPriceStart
              ? new Date(dto.specialPriceStart)
              : null,
          specialPriceEnd:
            !hasVariants && dto.specialPriceEnd
              ? new Date(dto.specialPriceEnd)
              : null,

          // Global inventory — only when NO variants
          sku: !hasVariants && dto.sku ? dto.sku : null,
          manageStock: !hasVariants ? (dto.manageStock ?? false) : false,
          qty: !hasVariants && dto.qty != null ? dto.qty : null,
          inStock: !hasVariants ? (dto.inStock ?? true) : true,
          lowStockThreshold: !hasVariants
            ? (dto.lowStockThreshold ?? null)
            : null,

          // Physical
          weight: dto.weight ? toDecimal(dto.weight) : null,
          length: dto.length ?? null,
          width: dto.width ?? null,
          height: dto.height ?? null,

          seo: dto.seo
            ? (dto.seo as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          newFrom: dto.newFrom ? new Date(dto.newFrom) : null,
          newTo: dto.newTo ? new Date(dto.newTo) : null,
          createdBy,
        },
      });

      // ─── 2. Link Categories ─────────────────────────────────
      if (dto.categoryIds?.length) {
        await tx.productCategory.createMany({
          data: dto.categoryIds.map((categoryId, idx) => ({
            productId: created.id,
            categoryId,
            isPrimary: idx === 0,
          })),
          skipDuplicates: true,
        });
      }

      // ─── 3. Link Tags ───────────────────────────────────────
      if (dto.tagIds?.length) {
        await tx.productTag.createMany({
          data: dto.tagIds.map((tagId) => ({ productId: created.id, tagId })),
          skipDuplicates: true,
        });
      }

      // ─── 4. Link Attributes ─────────────────────────────────
      if (dto.attributes?.length) {
        for (const attr of dto.attributes) {
          const pa = await tx.productAttribute.create({
            data: { productId: created.id, attributeId: attr.attributeId },
          });
          if (attr.attributeValueIds?.length) {
            await tx.productAttributeValue.createMany({
              data: attr.attributeValueIds.map((avId) => ({
                productAttributeId: pa.id,
                attributeValueId: avId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      // ─── 5. Handle Variations ───────────────────────────────
      const variationValueMap = new Map<string, string>(); // "varName:label" → valueId

      if (dto.variations?.length) {
        for (const varItem of dto.variations) {
          let variationId: string;

          if (varItem.variationId) {
            // Use existing global variation
            variationId = varItem.variationId;
            for (const val of varItem.values) {
              if (val.variationValueId) {
                variationValueMap.set(
                  `${varItem.name}:${val.label}`,
                  val.variationValueId,
                );
              }
            }
          } else {
            // Create new (product-specific) variation
            const varUid = slugify(varItem.name) || 'variation';
            let candidateUid = varUid;
            let counter = 0;
            while (
              await tx.variation.findFirst({
                where: { uid: candidateUid, deletedAt: null },
                select: { id: true },
              })
            ) {
              candidateUid = `${varUid}-${++counter}`;
            }

            const newVariation = await tx.variation.create({
              data: {
                uid: candidateUid,
                name: varItem.name,
                type: varItem.type,
                isGlobal: false,
                createdBy,
              },
            });
            variationId = newVariation.id;

            for (let i = 0; i < varItem.values.length; i++) {
              const val = varItem.values[i];
              if (val.variationValueId) {
                variationValueMap.set(
                  `${varItem.name}:${val.label}`,
                  val.variationValueId,
                );
              } else {
                const valUidBase = `${candidateUid}-${val.label}`;
                let valUid = slugify(valUidBase);
                let valCounter = 0;
                while (
                  await tx.variationValue.findFirst({
                    where: { uid: valUid, deletedAt: null },
                    select: { id: true },
                  })
                ) {
                  valUid = `${slugify(valUidBase)}-${++valCounter}`;
                }
                const newValue = await tx.variationValue.create({
                  data: {
                    uid: valUid,
                    variationId,
                    label: val.label,
                    value: val.value ?? null,
                    position: val.position ?? i,
                    createdBy,
                  },
                });
                variationValueMap.set(
                  `${varItem.name}:${val.label}`,
                  newValue.id,
                );
              }
            }
          }

          await tx.productVariation.create({
            data: { productId: created.id, variationId },
          });
        }
      }

      // ─── 6. Create Variants ─────────────────────────────────
      if (hasVariants && dto.variants) {
        for (let i = 0; i < dto.variants.length; i++) {
          const v = dto.variants[i];

          // Generate unique UID for variant
          const uidBase = slugify(v.name) || `variant-${i}`;
          let candidateUid = uidBase;
          let counter = 0;
          while (
            await tx.productVariant.findFirst({
              where: { uid: candidateUid, deletedAt: null },
              select: { id: true },
            })
          ) {
            candidateUid = `${uidBase}-${++counter}`;
          }

          // Build uids (concatenated variation value IDs for idempotent lookup)
          const labels = v.name.split('/').map((l) => l.trim());
          const valueIds: string[] = [];
          if (dto.variations) {
            for (let vi = 0; vi < dto.variations.length; vi++) {
              const varName = dto.variations[vi].name;
              const label = labels[vi] || '';
              const valueId = variationValueMap.get(`${varName}:${label}`);
              if (valueId) valueIds.push(valueId);
            }
          }

          const variant = await tx.productVariant.create({
            data: {
              uid: candidateUid,
              uids: valueIds.join('-') || candidateUid,
              productId: created.id,
              name: v.name,
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              price: toDecimal(v.price),
              specialPrice: toDecimal(v.specialPrice),
              specialPriceType: v.specialPriceType ?? null,
              specialPriceStart: v.specialPriceStart
                ? new Date(v.specialPriceStart)
                : null,
              specialPriceEnd: v.specialPriceEnd
                ? new Date(v.specialPriceEnd)
                : null,
              manageStock: v.manageStock ?? false,
              qty: v.qty ?? null,
              inStock: v.inStock ?? true,
              lowStockThreshold: v.lowStockThreshold ?? null,
              weight: v.weight ? toDecimal(v.weight) : null,
              isDefault: v.isDefault ?? i === 0,
              isActive: v.isActive ?? true,
              position: v.position ?? i,
            },
          });

          // ─── Link variant media ─────────────────────────────
          if (v.mediaIds?.length) {
            await tx.entityMedia.createMany({
              data: v.mediaIds.map((mediaId, idx) => ({
                entityType: 'ProductVariant',
                entityId: variant.id,
                mediaId,
                position: idx,
                purpose: 'gallery',
                isMain: mediaId === (v.mainMediaId ?? v.mediaIds![0]),
              })),
              skipDuplicates: true,
            });
            await tx.media.updateMany({
              where: { id: { in: v.mediaIds } },
              data: { referenceCount: { increment: 1 } },
            });
          }
        }
      }

      // ─── 7. Linked Products ─────────────────────────────────
      if (dto.relatedProductIds?.length) {
        await tx.relatedProduct.createMany({
          data: dto.relatedProductIds.map((relId, idx) => ({
            productId: created.id,
            relatedProductId: relId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }
      if (dto.upSellProductIds?.length) {
        await tx.upSellProduct.createMany({
          data: dto.upSellProductIds.map((upId, idx) => ({
            productId: created.id,
            upSellProductId: upId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }
      if (dto.crossSellProductIds?.length) {
        await tx.crossSellProduct.createMany({
          data: dto.crossSellProductIds.map((csId, idx) => ({
            productId: created.id,
            crossSellProductId: csId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // ─── 8. Link product-level media (outside tx) ────────────
    if (dto.mediaIds?.length) {
      await this.prisma.entityMedia.createMany({
        data: dto.mediaIds.map((mediaId, idx) => ({
          entityType: 'Product',
          entityId: product.id,
          mediaId,
          position: idx,
          purpose: 'gallery',
          isMain: mediaId === (dto.mainMediaId ?? dto.mediaIds![0]),
        })),
        skipDuplicates: true,
      });
      await this.prisma.media.updateMany({
        where: { id: { in: dto.mediaIds } },
        data: { referenceCount: { increment: 1 } },
      });
    }

    // ─── 9. Compute price range (for variant products) ───────
    if (hasVariants) {
      await this.recomputePriceRange(product.id);
    }

    this.logger.log(`Product created: "${slug}" by ${createdBy}`);
    return this.findOne(product.id);
  }

  // ══════════════════════════════════════════════════════════════
  // LIST PRODUCTS
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { sku: { contains: dto.search, mode: 'insensitive' } },
          { shortDescription: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.brandId && { brandId: dto.brandId }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      ...(dto.inStock !== undefined && { inStock: dto.inStock }),
      ...(dto.categoryId && {
        categories: { some: { categoryId: dto.categoryId } },
      }),
      ...(dto.tagId && { tags: { some: { tagId: dto.tagId } } }),
      ...((dto.priceMin !== undefined || dto.priceMax !== undefined) && {
        OR: [
          {
            price: {
              ...(dto.priceMin !== undefined && { gte: dto.priceMin }),
              ...(dto.priceMax !== undefined && { lte: dto.priceMax }),
            },
          },
          {
            variants: {
              some: {
                deletedAt: null,
                price: {
                  ...(dto.priceMin !== undefined && { gte: dto.priceMin }),
                  ...(dto.priceMax !== undefined && { lte: dto.priceMax }),
                },
              },
            },
          },
        ],
      }),
    };

    const orderBy = this.buildOrderBy(dto.sortBy);

    if (dto.detail) {
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: PRODUCT_FULL_INCLUDE,
          orderBy,
          skip: dto.skip,
          take: dto.take,
        }),
        this.prisma.product.count({ where }),
      ]);

      const data = await Promise.all(products.map((p) => this.attachMedia(p)));

      return {
        data,
        total,
        meta: {
          skip: dto.skip,
          take: dto.take,
          page: Math.floor(dto.skip / dto.take) + 1,
          pageCount: Math.ceil(total / dto.take) || 1,
          hasMore: dto.skip + dto.take < total,
        },
      };
    }

    // Summary mode — attach media for each
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SUMMARY_SELECT,
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Attach media to summary results
    const data = await Promise.all(
      products.map(async (p) => {
        const media = await this.prisma.entityMedia.findMany({
          where: { entityType: 'Product', entityId: p.id },
          include: MEDIA_INCLUDE,
          orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
        });
        return { ...p, media };
      }),
    );

    return {
      data,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
        pageCount: Math.ceil(total / dto.take) || 1,
        hasMore: dto.skip + dto.take < total,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET SINGLE PRODUCT BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_FULL_INCLUDE,
    });

    if (!product) throw new NotFoundException('Product not found');

    // Fire-and-forget view count
    this.prisma.product
      .update({ where: { id }, data: { viewed: { increment: 1 } } })
      .catch(() => {});

    return this.attachMedia(product);
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: PRODUCT_FULL_INCLUDE,
    });

    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    this.prisma.product
      .update({ where: { id: product.id }, data: { viewed: { increment: 1 } } })
      .catch(() => {});

    return this.attachMedia(product);
  }

  // ══════════════════════════════════════════════════════════════
  // GET BY CATEGORY SLUG
  // ══════════════════════════════════════════════════════════════
  async findByCategorySlug(categorySlug: string, dto: ListProductsDto) {
    const category = await this.prisma.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    dto.categoryId = category.id;
    const result = await this.findAll(dto);
    return { ...result, category };
  }

  // ══════════════════════════════════════════════════════════════
  // SEARCH (for dropdowns)
  // ══════════════════════════════════════════════════════════════
  // async search(query: string, limit = 20) {
  //   if (!query || query.trim().length < 2) return [];

  //   const products = await this.prisma.product.findMany({
  //     where: {
  //       deletedAt: null,
  //       isActive: true,
  //       OR: [
  //         { name: { contains: query, mode: 'insensitive' } },
  //         { sku: { contains: query, mode: 'insensitive' } },
  //       ],
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //       slug: true,
  //       sku: true,
  //       price: true,
  //       specialPrice: true,
  //       inStock: true,
  //       images: true,
  //     },
  //     take: Math.min(limit, 50),
  //     orderBy: { name: 'asc' },
  //   });

  //   // Attach main image
  //   return Promise.all(
  //     products.map(async (p) => {
  //       const mainImage = await this.prisma.entityMedia.findFirst({
  //         where: { entityType: 'Product', entityId: p.id, isMain: true },
  //         include: MEDIA_INCLUDE,
  //       });
  //       return { ...p, mainImage };
  //     }),
  //   );
  // }
  async search(query: string, limit = 20) {
    if (!query || query.trim().length < 2) return [];

    // Track the search term (fire-and-forget)
    this.prisma.searchTerm
      .upsert({
        where: { term: query.toLowerCase().trim() },
        create: {
          term: query.toLowerCase().trim(),
          count: 1,
          lastUsedAt: new Date(),
        },
        update: { count: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => {}); // non-blocking

    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        specialPrice: true,
        inStock: true,
        images: true,
      },
      take: Math.min(limit, 50),
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      products.map(async (p) => {
        const mainImage = await this.prisma.entityMedia.findFirst({
          where: { entityType: 'Product', entityId: p.id, isMain: true },
          include: MEDIA_INCLUDE,
        });
        return { ...p, mainImage };
      }),
    );
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE PRODUCT
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, sku: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const hasVariants = !!dto.variants?.length;

    if (!hasVariants && dto.sku && dto.sku !== existing.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { sku: dto.sku, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (skuExists)
        throw new ConflictException('Product with this SKU already exists');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.shortDescription !== undefined && {
            shortDescription: dto.shortDescription,
          }),
          ...(dto.brandId !== undefined && { brandId: dto.brandId || null }),
          ...(dto.taxClassId !== undefined && {
            taxClassId: dto.taxClassId || null,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),

          ...(dto.price !== undefined && {
            price: !hasVariants ? toDecimal(dto.price) : null,
          }),
          ...(dto.specialPrice !== undefined && {
            specialPrice: !hasVariants ? toDecimal(dto.specialPrice) : null,
          }),
          ...(dto.specialPriceType !== undefined && {
            specialPriceType: !hasVariants ? dto.specialPriceType : null,
          }),
          ...(dto.specialPriceStart !== undefined && {
            specialPriceStart:
              !hasVariants && dto.specialPriceStart
                ? new Date(dto.specialPriceStart)
                : null,
          }),
          ...(dto.specialPriceEnd !== undefined && {
            specialPriceEnd:
              !hasVariants && dto.specialPriceEnd
                ? new Date(dto.specialPriceEnd)
                : null,
          }),

          ...(dto.sku !== undefined && { sku: !hasVariants ? dto.sku : null }),
          ...(dto.manageStock !== undefined && {
            manageStock: !hasVariants ? dto.manageStock : false,
          }),
          ...(dto.qty !== undefined && { qty: !hasVariants ? dto.qty : null }),
          ...(dto.inStock !== undefined && {
            inStock: !hasVariants ? dto.inStock : true,
          }),
          ...(dto.lowStockThreshold !== undefined && {
            lowStockThreshold: !hasVariants ? dto.lowStockThreshold : null,
          }),

          ...(dto.weight !== undefined && {
            weight: dto.weight ? toDecimal(dto.weight) : null,
          }),
          ...(dto.length !== undefined && { length: dto.length }),
          ...(dto.width !== undefined && { width: dto.width }),
          ...(dto.height !== undefined && { height: dto.height }),

          ...(dto.seo !== undefined && {
            seo: dto.seo
              ? (dto.seo as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }),
          ...(dto.translations !== undefined && {
            translations: dto.translations
              ? (dto.translations as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }),
          ...(dto.newFrom !== undefined && {
            newFrom: dto.newFrom ? new Date(dto.newFrom) : null,
          }),
          ...(dto.newTo !== undefined && {
            newTo: dto.newTo ? new Date(dto.newTo) : null,
          }),

          updatedBy,
        },
      });

      // Sync Categories
      if (dto.categoryIds !== undefined) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (dto.categoryIds.length) {
          await tx.productCategory.createMany({
            data: dto.categoryIds.map((catId, idx) => ({
              productId: id,
              categoryId: catId,
              isPrimary: idx === 0,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Sync Tags
      if (dto.tagIds !== undefined) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        if (dto.tagIds.length) {
          await tx.productTag.createMany({
            data: dto.tagIds.map((tagId) => ({ productId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // Sync Attributes
      if (dto.attributes !== undefined) {
        const oldAttrs = await tx.productAttribute.findMany({
          where: { productId: id },
          select: { id: true },
        });
        for (const oa of oldAttrs) {
          await tx.productAttributeValue.deleteMany({
            where: { productAttributeId: oa.id },
          });
        }
        await tx.productAttribute.deleteMany({ where: { productId: id } });
        for (const attr of dto.attributes) {
          const pa = await tx.productAttribute.create({
            data: { productId: id, attributeId: attr.attributeId },
          });
          if (attr.attributeValueIds.length) {
            await tx.productAttributeValue.createMany({
              data: attr.attributeValueIds.map((avId) => ({
                productAttributeId: pa.id,
                attributeValueId: avId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      // Sync Linked Products
      if (dto.relatedProductIds !== undefined) {
        await tx.relatedProduct.deleteMany({ where: { productId: id } });
        if (dto.relatedProductIds.length) {
          await tx.relatedProduct.createMany({
            data: dto.relatedProductIds.map((rId, idx) => ({
              productId: id,
              relatedProductId: rId,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }
      if (dto.upSellProductIds !== undefined) {
        await tx.upSellProduct.deleteMany({ where: { productId: id } });
        if (dto.upSellProductIds.length) {
          await tx.upSellProduct.createMany({
            data: dto.upSellProductIds.map((uId, idx) => ({
              productId: id,
              upSellProductId: uId,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }
      if (dto.crossSellProductIds !== undefined) {
        await tx.crossSellProduct.deleteMany({ where: { productId: id } });
        if (dto.crossSellProductIds.length) {
          await tx.crossSellProduct.createMany({
            data: dto.crossSellProductIds.map((cId, idx) => ({
              productId: id,
              crossSellProductId: cId,
              position: idx,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    // Update media links (outside transaction)
    if (dto.mediaIds !== undefined) {
      await this.replaceProductMedia(id, {
        mediaIds: dto.mediaIds,
        mainMediaId: dto.mainMediaId,
      });
    }

    if (hasVariants) await this.recomputePriceRange(id);

    this.logger.log(`Product updated: ${id} by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE PRODUCT (SOFT)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.productVariant.updateMany({
      where: { productId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });

    await this.prisma.softDelete('product', id, deletedBy);
    this.logger.log(`Product deleted: "${product.slug}" by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // ─── MEDIA MANAGEMENT ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  /**
   * Add media to product (append, does not replace existing)
   */
  async addProductMedia(
    productId: string,
    dto: AddProductMediaDto,
  ): Promise<any> {
    await this._ensureProductExists(productId);

    const existing = await this.prisma.entityMedia.findMany({
      where: { entityType: 'Product', entityId: productId },
      select: { mediaId: true, position: true },
      orderBy: { position: 'desc' },
    });

    const existingIds = new Set(existing.map((e) => e.mediaId));
    const maxPosition = existing[0]?.position ?? -1;
    const toAdd = dto.mediaIds.filter((id) => !existingIds.has(id));

    if (!toAdd.length) return this.findOne(productId);

    await this.prisma.entityMedia.createMany({
      data: toAdd.map((mediaId, idx) => ({
        entityType: 'Product',
        entityId: productId,
        mediaId,
        position: maxPosition + 1 + idx,
        purpose: dto.purpose ?? 'gallery',
        isMain: existing.length === 0 && idx === 0,
      })),
      skipDuplicates: true,
    });

    await this.prisma.media.updateMany({
      where: { id: { in: toAdd } },
      data: { referenceCount: { increment: 1 } },
    });

    if (dto.mainMediaId) {
      await this._setMainMedia('Product', productId, dto.mainMediaId);
    }

    this.logger.log(`Added ${toAdd.length} media to product ${productId}`);
    return this.findOne(productId);
  }

  /**
   * Replace all product media
   */
  async replaceProductMedia(
    productId: string,
    dto: ReplaceProductMediaDto,
  ): Promise<any> {
    await this._ensureProductExists(productId);

    const existing = await this.prisma.entityMedia.findMany({
      where: { entityType: 'Product', entityId: productId },
      select: { mediaId: true },
    });
    const existingIds = existing.map((e) => e.mediaId);
    const newIds = dto.mediaIds;

    const toRemove = existingIds.filter((id) => !newIds.includes(id));
    const toAdd = newIds.filter((id) => !existingIds.includes(id));

    if (toRemove.length) {
      await this.prisma.entityMedia.deleteMany({
        where: {
          entityType: 'Product',
          entityId: productId,
          mediaId: { in: toRemove },
        },
      });
      await this.prisma.media.updateMany({
        where: { id: { in: toRemove }, referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }

    if (toAdd.length) {
      const currentCount = newIds.length - toAdd.length;
      await this.prisma.entityMedia.createMany({
        data: toAdd.map((mediaId, idx) => ({
          entityType: 'Product',
          entityId: productId,
          mediaId,
          position: currentCount + idx,
          purpose: 'gallery',
          isMain: false,
        })),
        skipDuplicates: true,
      });
      await this.prisma.media.updateMany({
        where: { id: { in: toAdd } },
        data: { referenceCount: { increment: 1 } },
      });
    }

    // Re-apply positions based on provided order
    for (let i = 0; i < newIds.length; i++) {
      await this.prisma.entityMedia.updateMany({
        where: {
          entityType: 'Product',
          entityId: productId,
          mediaId: newIds[i],
        },
        data: {
          position: i,
          isMain: newIds[i] === (dto.mainMediaId ?? newIds[0]),
        },
      });
    }

    this.logger.log(`Replaced media for product ${productId}`);
    return this.findOne(productId);
  }

  /**
   * Remove specific media from product
   */
  async removeProductMedia(productId: string, mediaId: string): Promise<any> {
    await this._ensureProductExists(productId);

    const link = await this.prisma.entityMedia.findFirst({
      where: { entityType: 'Product', entityId: productId, mediaId },
    });

    if (!link) throw new NotFoundException('Media not linked to this product');

    await this.prisma.entityMedia.delete({
      where: {
        entityType_entityId_mediaId: {
          entityType: 'Product',
          entityId: productId,
          mediaId,
        },
      },
    });

    await this.prisma.media.updateMany({
      where: { id: mediaId, referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });

    // If removed image was main, promote the next one
    if (link.isMain) {
      const next = await this.prisma.entityMedia.findFirst({
        where: { entityType: 'Product', entityId: productId },
        orderBy: { position: 'asc' },
      });
      if (next) {
        await this.prisma.entityMedia.updateMany({
          where: {
            entityType: 'Product',
            entityId: productId,
            mediaId: next.mediaId,
          },
          data: { isMain: true },
        });
      }
    }

    return this.findOne(productId);
  }

  /**
   * Reorder product images
   */
  async reorderProductMedia(
    productId: string,
    dto: ReorderProductMediaDto,
  ): Promise<any> {
    await this._ensureProductExists(productId);

    for (const item of dto.items) {
      await this.prisma.entityMedia.updateMany({
        where: {
          entityType: 'Product',
          entityId: productId,
          mediaId: item.mediaId,
        },
        data: { position: item.position },
      });
    }

    return this.findOne(productId);
  }

  /**
   * Set main/thumbnail image
   */
  async setMainMedia(productId: string, dto: SetMainMediaDto): Promise<any> {
    await this._ensureProductExists(productId);
    await this._setMainMedia('Product', productId, dto.mediaId);
    return this.findOne(productId);
  }

  /**
   * Get all media for a product
   */
  async getProductMedia(productId: string) {
    await this._ensureProductExists(productId);
    return this.prisma.entityMedia.findMany({
      where: { entityType: 'Product', entityId: productId },
      include: MEDIA_INCLUDE,
      orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Variant Media Management
  // ──────────────────────────────────────────────────────────────

  async addVariantMedia(
    productId: string,
    variantId: string,
    dto: AddProductMediaDto,
  ) {
    const variant = await this._ensureVariantExists(productId, variantId);

    const existing = await this.prisma.entityMedia.findMany({
      where: { entityType: 'ProductVariant', entityId: variantId },
      select: { mediaId: true, position: true },
      orderBy: { position: 'desc' },
    });

    const existingIds = new Set(existing.map((e) => e.mediaId));
    const maxPos = existing[0]?.position ?? -1;
    const toAdd = dto.mediaIds.filter((id) => !existingIds.has(id));

    if (!toAdd.length) return this.findOne(productId);

    await this.prisma.entityMedia.createMany({
      data: toAdd.map((mediaId, idx) => ({
        entityType: 'ProductVariant',
        entityId: variantId,
        mediaId,
        position: maxPos + 1 + idx,
        purpose: dto.purpose ?? 'gallery',
        isMain: existing.length === 0 && idx === 0,
      })),
      skipDuplicates: true,
    });

    await this.prisma.media.updateMany({
      where: { id: { in: toAdd } },
      data: { referenceCount: { increment: 1 } },
    });

    if (dto.mainMediaId) {
      await this._setMainMedia('ProductVariant', variantId, dto.mainMediaId);
    }

    return this.findOne(productId);
  }

  async replaceVariantMedia(
    productId: string,
    variantId: string,
    dto: ReplaceProductMediaDto,
  ) {
    await this._ensureVariantExists(productId, variantId);

    const existing = await this.prisma.entityMedia.findMany({
      where: { entityType: 'ProductVariant', entityId: variantId },
      select: { mediaId: true },
    });
    const toRemove = existing
      .map((e) => e.mediaId)
      .filter((id) => !dto.mediaIds.includes(id));
    const toAdd = dto.mediaIds.filter(
      (id) => !existing.map((e) => e.mediaId).includes(id),
    );

    if (toRemove.length) {
      await this.prisma.entityMedia.deleteMany({
        where: {
          entityType: 'ProductVariant',
          entityId: variantId,
          mediaId: { in: toRemove },
        },
      });
      await this.prisma.media.updateMany({
        where: { id: { in: toRemove }, referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }

    if (toAdd.length) {
      await this.prisma.entityMedia.createMany({
        data: toAdd.map((mediaId, idx) => ({
          entityType: 'ProductVariant',
          entityId: variantId,
          mediaId,
          position: dto.mediaIds.indexOf(mediaId),
          purpose: 'gallery',
          isMain: mediaId === (dto.mainMediaId ?? dto.mediaIds[0]),
        })),
        skipDuplicates: true,
      });
      await this.prisma.media.updateMany({
        where: { id: { in: toAdd } },
        data: { referenceCount: { increment: 1 } },
      });
    }

    // Update positions
    for (let i = 0; i < dto.mediaIds.length; i++) {
      await this.prisma.entityMedia.updateMany({
        where: {
          entityType: 'ProductVariant',
          entityId: variantId,
          mediaId: dto.mediaIds[i],
        },
        data: {
          position: i,
          isMain: dto.mediaIds[i] === (dto.mainMediaId ?? dto.mediaIds[0]),
        },
      });
    }

    return this.findOne(productId);
  }

  async removeVariantMedia(
    productId: string,
    variantId: string,
    mediaId: string,
  ) {
    await this._ensureVariantExists(productId, variantId);

    const link = await this.prisma.entityMedia.findFirst({
      where: { entityType: 'ProductVariant', entityId: variantId, mediaId },
    });
    if (!link) throw new NotFoundException('Media not linked to this variant');

    await this.prisma.entityMedia.delete({
      where: {
        entityType_entityId_mediaId: {
          entityType: 'ProductVariant',
          entityId: variantId,
          mediaId,
        },
      },
    });
    await this.prisma.media.updateMany({
      where: { id: mediaId, referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });

    if (link.isMain) {
      const next = await this.prisma.entityMedia.findFirst({
        where: { entityType: 'ProductVariant', entityId: variantId },
        orderBy: { position: 'asc' },
      });
      if (next) {
        await this.prisma.entityMedia.updateMany({
          where: {
            entityType: 'ProductVariant',
            entityId: variantId,
            mediaId: next.mediaId,
          },
          data: { isMain: true },
        });
      }
    }

    return this.findOne(productId);
  }

  // ══════════════════════════════════════════════════════════════
  // ─── VARIANT MANAGEMENT ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  async bulkEditVariants(productId: string, dto: BulkEditVariantDto) {
    await this._ensureProductExists(productId);

    const updateData: Record<string, unknown> = {};
    switch (dto.field) {
      case 'price':
        updateData.price = new Prisma.Decimal(Number(dto.value));
        break;
      case 'specialPrice':
        updateData.specialPrice = new Prisma.Decimal(Number(dto.value));
        break;
      case 'specialPriceType':
        updateData.specialPriceType = dto.value as string;
        break;
      case 'manageStock':
        updateData.manageStock = Boolean(dto.value);
        break;
      case 'inStock':
        updateData.inStock = Boolean(dto.value);
        break;
      case 'qty':
        updateData.qty = Number(dto.value);
        break;
      default:
        throw new BadRequestException(`Invalid field: ${dto.field}`);
    }

    await this.prisma.productVariant.updateMany({
      where: { productId, deletedAt: null },
      data: updateData,
    });

    await this.recomputePriceRange(productId);
    this.logger.log(
      `Bulk edit variants: ${dto.field}=${dto.value} for product ${productId}`,
    );
    return this.findOne(productId);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    updatedBy: string,
  ) {
    await this._ensureVariantExists(productId, variantId);

    if (dto.sku) {
      const skuExists = await this.prisma.productVariant.findFirst({
        where: { sku: dto.sku, deletedAt: null, id: { not: variantId } },
        select: { id: true },
      });
      if (skuExists)
        throw new ConflictException(`Variant SKU "${dto.sku}" already exists`);
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode || null }),
        ...(dto.price !== undefined && { price: toDecimal(dto.price) }),
        ...(dto.specialPrice !== undefined && {
          specialPrice: toDecimal(dto.specialPrice),
        }),
        ...(dto.specialPriceType !== undefined && {
          specialPriceType: dto.specialPriceType,
        }),
        ...(dto.specialPriceStart !== undefined && {
          specialPriceStart: dto.specialPriceStart
            ? new Date(dto.specialPriceStart)
            : null,
        }),
        ...(dto.specialPriceEnd !== undefined && {
          specialPriceEnd: dto.specialPriceEnd
            ? new Date(dto.specialPriceEnd)
            : null,
        }),
        ...(dto.manageStock !== undefined && { manageStock: dto.manageStock }),
        ...(dto.inStock !== undefined && { inStock: dto.inStock }),
        ...(dto.qty !== undefined && { qty: dto.qty }),
        ...(dto.lowStockThreshold !== undefined && {
          lowStockThreshold: dto.lowStockThreshold,
        }),
        ...(dto.weight !== undefined && {
          weight: dto.weight ? toDecimal(dto.weight) : null,
        }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });

    if (dto.mediaIds !== undefined) {
      await this.replaceVariantMedia(productId, variantId, {
        mediaIds: dto.mediaIds,
        mainMediaId: dto.mainMediaId,
      });
    }

    await this.recomputePriceRange(productId);
    this.logger.log(`Variant updated: ${variantId} by ${updatedBy}`);
    return this.findOne(productId);
  }

  async deleteVariant(productId: string, variantId: string, deletedBy: string) {
    await this._ensureVariantExists(productId, variantId);

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date(), deletedBy },
    });

    await this.recomputePriceRange(productId);
    this.logger.log(`Variant deleted: ${variantId} by ${deletedBy}`);
    return this.findOne(productId);
  }

  // ══════════════════════════════════════════════════════════════
  // ─── REVIEWS ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  async createReview(
    productId: string,
    dto: CreateReviewDto,
    customerId?: string,
  ) {
    await this._ensureProductExists(productId);

    const review = await this.prisma.review.create({
      data: {
        productId,
        reviewerId: customerId ?? null,
        reviewerName: dto.reviewerName,
        rating: dto.rating,
        title: dto.title ?? null,
        comment: dto.comment,
        isApproved: !customerId, // auto-approve if no customer
      },
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        reviewerName: true,
        isApproved: true,
        createdAt: true,
      },
    });

    this.logger.log(`Review created for product ${productId}`);
    return review;
  }

  async listReviews(productId: string, dto: ListReviewsDto) {
    await this._ensureProductExists(productId);

    const where: Prisma.ReviewWhereInput = {
      productId,
      deletedAt: null,
      ...(dto.isApproved !== undefined
        ? { isApproved: dto.isApproved }
        : { isApproved: true }),
      ...(dto.rating && { rating: dto.rating }),
    };

    const orderByMap: Record<string, Prisma.ReviewOrderByWithRelationInput> = {
      newest: { createdAt: 'desc' },
      oldest: { createdAt: 'asc' },
      highest_rating: { rating: 'desc' },
      lowest_rating: { rating: 'asc' },
    };
    const orderBy = orderByMap[dto.sortBy ?? 'newest'] ?? { createdAt: 'desc' };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          reviewerName: true,
          isApproved: true,
          adminReply: true,
          createdAt: true,
          updatedAt: true,
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.review.count({ where }),
    ]);

    // Rating distribution
    const distribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, isApproved: true, deletedAt: null },
      _count: { rating: true },
    });

    const ratingCounts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    distribution.forEach((d) => {
      ratingCounts[d.rating] = d._count.rating;
    });

    return {
      data: reviews,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
        pageCount: Math.ceil(total / dto.take) || 1,
      },
      ratingDistribution: ratingCounts,
    };
  }

  async approveReview(reviewId: string, adminId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true, productId: true, isApproved: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });

    await this.recomputeRating(review.productId);
    return { message: 'Review approved' };
  }

  async rejectReview(reviewId: string, adminId: string) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true, productId: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.softDelete('review', reviewId, adminId);
    await this.recomputeRating(review.productId);
    return { message: 'Review rejected' };
  }

  async replyToReview(
    reviewId: string,
    dto: AdminReviewReplyDto,
    adminId: string,
  ) {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, deletedAt: null },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        adminReply: {
          reply: dto.reply,
          repliedAt: new Date().toISOString(),
          repliedBy: adminId,
        } as Prisma.InputJsonValue,
      },
      select: { id: true, adminReply: true, updatedAt: true },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ─── QUESTIONS & ANSWERS ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  async createQuestion(
    productId: string,
    dto: CreateQuestionDto,
    customerId?: string,
  ) {
    await this._ensureProductExists(productId);

    return this.prisma.productQuestion.create({
      data: {
        productId,
        customerId: customerId ?? null,
        askerName: dto.askerName,
        question: dto.question,
        isPublished: false,
        isAnswered: false,
      },
      select: {
        id: true,
        question: true,
        askerName: true,
        isPublished: true,
        isAnswered: true,
        createdAt: true,
      },
    });
  }

  async listQuestions(
    productId: string,
    dto: ListQuestionsDto,
    adminView = false,
  ) {
    await this._ensureProductExists(productId);

    const where: Prisma.ProductQuestionWhereInput = {
      productId,
      deletedAt: null,
      ...(!adminView && { isPublished: true }),
    };

    const [questions, total] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        include: {
          answers: {
            where: { isPublished: true, deletedAt: null },
            select: {
              id: true,
              answer: true,
              answererName: true,
              isPublished: true,
              helpfulVotes: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.productQuestion.count({ where }),
    ]);

    return {
      data: questions,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
      },
    };
  }

  async publishQuestion(questionId: string) {
    const q = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
    });
    if (!q) throw new NotFoundException('Question not found');

    return this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { isPublished: true },
    });
  }

  async answerQuestion(
    questionId: string,
    dto: CreateAnswerDto,
    adminId?: string,
  ) {
    const q = await this.prisma.productQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true },
    });
    if (!q) throw new NotFoundException('Question not found');

    const answer = await this.prisma.productAnswer.create({
      data: {
        questionId,
        adminId: adminId ?? null,
        answererName: dto.answererName,
        answer: dto.answer,
        isPublished: true,
      },
    });

    await this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { isAnswered: true },
    });

    return answer;
  }

  // ══════════════════════════════════════════════════════════════
  // ─── INVENTORY HELPERS ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  /**
   * Get inventory status for product + all variants
   */
  async getInventory(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        manageStock: true,
        qty: true,
        inStock: true,
        lowStockThreshold: true,
        variants: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            manageStock: true,
            qty: true,
            reservedQty: true,
            inStock: true,
            lowStockThreshold: true,
            isActive: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    return {
      ...product,
      variants: product.variants.map((v) => ({
        ...v,
        availableQty:
          v.qty != null && v.reservedQty != null ? v.qty - v.reservedQty : null,
        isLowStock:
          v.lowStockThreshold != null && v.qty != null
            ? v.qty <= v.lowStockThreshold
            : false,
      })),
    };
  }

  /**
   * Adjust stock for a product or variant
   */
  async adjustStock(
    productId: string,
    variantId: string | null,
    qtyChange: number,
    reason: string,
    changedBy: string,
    notes?: string,
  ) {
    if (variantId) {
      const variant = await this._ensureVariantExists(productId, variantId);
      const currentQty = variant.qty ?? 0;
      const newQty = Math.max(0, currentQty + qtyChange);

      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { qty: newQty, inStock: newQty > 0 },
      });

      await this.prisma.inventoryLog.create({
        data: {
          productId,
          productVariantId: variantId,
          sku: variant.sku ?? undefined,
          reason: reason as any,
          qtyBefore: currentQty,
          qtyChange,
          qtyAfter: newQty,
          notes: notes ?? null,
          changedBy,
        },
      });
    } else {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { qty: true, sku: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      const currentQty = product.qty ?? 0;
      const newQty = Math.max(0, currentQty + qtyChange);

      await this.prisma.product.update({
        where: { id: productId },
        data: { qty: newQty, inStock: newQty > 0 },
      });

      await this.prisma.inventoryLog.create({
        data: {
          productId,
          sku: product.sku ?? undefined,
          reason: reason as any,
          qtyBefore: currentQty,
          qtyChange,
          qtyAfter: newQty,
          notes: notes ?? null,
          changedBy,
        },
      });
    }

    return this.getInventory(productId);
  }

  /**
   * Get inventory change history
   */
  async getInventoryLogs(productId: string, skip = 0, take = 20) {
    const [logs, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where: { productId },
        select: {
          id: true,
          sku: true,
          reason: true,
          qtyBefore: true,
          qtyChange: true,
          qtyAfter: true,
          notes: true,
          changedBy: true,
          createdAt: true,
          productVariant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.inventoryLog.count({ where: { productId } }),
    ]);

    return {
      data: logs,
      total,
      meta: {
        skip,
        take,
        page: Math.floor(skip / take) + 1,
        pageCount: Math.ceil(total / take) || 1,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── PRICE HISTORY ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  async getPriceHistory(
    productId: string,
    variantId?: string,
    skip = 0,
    take = 20,
  ) {
    const where: Prisma.PriceHistoryWhereInput = {
      productId,
      ...(variantId && { productVariantId: variantId }),
    };

    const [history, total] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where,
        select: {
          id: true,
          previousPrice: true,
          newPrice: true,
          previousSpecialPrice: true,
          newSpecialPrice: true,
          changedBy: true,
          changedAt: true,
          productVariant: { select: { id: true, name: true } },
        },
        orderBy: { changedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.priceHistory.count({ where }),
    ]);

    return {
      data: history,
      total,
      meta: {
        skip,
        take,
        page: Math.floor(skip / take) + 1,
        pageCount: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Validate one or more products for checkout.
   * Returns fresh prices, active status, stock check.
   * Called by CheckoutService before creating an order.
   */
  async validateForCheckout(
    items: Array<{ productId: string; variantId?: string | null; qty: number }>,
  ): Promise<{
    valid: boolean;
    lines: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      productSlug: string;
      productSku: string | null;
      productImage: any;
      unitPrice: number;
      qty: number;
      lineTotal: number;
      variationsSnapshot: any;
    }>;
    errors: Array<{ productId: string; message: string }>;
  }> {
    const lines: any[] = [];
    const errors: Array<{ productId: string; message: string }> = [];

    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null, isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          specialPrice: true,
          specialPriceType: true,
          specialPriceStart: true,
          specialPriceEnd: true,
          inStock: true,
          manageStock: true,
          qty: true,
          images: true,
          taxClassId: true,
        },
      });

      if (!product) {
        errors.push({
          productId: item.productId,
          message: 'Product not found or inactive',
        });
        continue;
      }

      if (!product.inStock) {
        errors.push({
          productId: item.productId,
          message: `"${product.name}" is out of stock`,
        });
        continue;
      }

      if (item.variantId) {
        const variant = await this.prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            productId: item.productId,
            deletedAt: null,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            specialPrice: true,
            specialPriceType: true,
            specialPriceStart: true,
            specialPriceEnd: true,
            inStock: true,
            manageStock: true,
            qty: true,
            reservedQty: true,
            images: true,
          },
        });

        if (!variant) {
          errors.push({
            productId: item.productId,
            message: 'Variant not found or inactive',
          });
          continue;
        }
        if (!variant.inStock) {
          errors.push({
            productId: item.productId,
            message: `Variant "${variant.name}" is out of stock`,
          });
          continue;
        }
        if (variant.manageStock && variant.qty != null) {
          const free = variant.qty - variant.reservedQty;
          if (free < item.qty) {
            errors.push({
              productId: item.productId,
              message: `Only ${Math.max(0, free)} of "${variant.name}" available`,
            });
            continue;
          }
        }

        const now = new Date();
        const useSpecial =
          variant.specialPrice != null &&
          (!variant.specialPriceStart || variant.specialPriceStart <= now) &&
          (!variant.specialPriceEnd || variant.specialPriceEnd >= now);
        const unitPrice = (
          useSpecial ? variant.specialPrice! : (variant.price ?? product.price!)
        ).toNumber();

        lines.push({
          productId: item.productId,
          variantId: item.variantId,
          productName: `${product.name} - ${variant.name}`,
          productSlug: product.slug,
          productSku: variant.sku ?? product.sku,
          productImage: variant.images ?? product.images,
          unitPrice,
          qty: item.qty,
          lineTotal: parseFloat((unitPrice * item.qty).toFixed(4)),
          variationsSnapshot: null,
          taxClassId: product.taxClassId,
        });
      } else {
        if (
          product.manageStock &&
          product.qty != null &&
          product.qty < item.qty
        ) {
          errors.push({
            productId: item.productId,
            message: `Only ${product.qty} of "${product.name}" available`,
          });
          continue;
        }

        const now = new Date();
        const useSpecial =
          product.specialPrice != null &&
          (!product.specialPriceStart || product.specialPriceStart <= now) &&
          (!product.specialPriceEnd || product.specialPriceEnd >= now);
        const unitPrice = (
          useSpecial ? product.specialPrice! : product.price!
        ).toNumber();

        lines.push({
          productId: item.productId,
          variantId: null,
          productName: product.name,
          productSlug: product.slug,
          productSku: product.sku,
          productImage: product.images,
          unitPrice,
          qty: item.qty,
          lineTotal: parseFloat((unitPrice * item.qty).toFixed(4)),
          variationsSnapshot: null,
          taxClassId: product.taxClassId,
        });
      }
    }

    return { valid: errors.length === 0, lines, errors };
  }

  // ══════════════════════════════════════════════════════════════
  // ─── PRIVATE HELPERS ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  private async _ensureProductExists(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async _ensureVariantExists(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
      select: { id: true, name: true, sku: true, qty: true, reservedQty: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  private async _setMainMedia(
    entityType: string,
    entityId: string,
    mediaId: string,
  ) {
    // Unset all main flags
    await this.prisma.entityMedia.updateMany({
      where: { entityType, entityId },
      data: { isMain: false },
    });
    // Set new main
    await this.prisma.entityMedia.updateMany({
      where: { entityType, entityId, mediaId },
      data: { isMain: true },
    });
  }
}
