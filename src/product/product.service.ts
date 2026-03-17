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
} from './dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { Prisma } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180);
}

/** Convert number | undefined → Prisma Decimal | null */
function toDecimal(value: number | undefined | null): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

// ─── Full product include for reads ───────────────────────────
const PRODUCT_FULL_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true } },
  taxClass: { select: { id: true, name: true } },
  categories: {
    where: {
      category: {
        deletedAt: null,
      },
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  tags: {
    include: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
  attributes: {
    include: {
      attribute: { select: { id: true, name: true, type: true } },
      value: {
        include: {
          attributeValue: { select: { id: true, value: true } },
        },
      },
    },
  },
  variations: {
    include: {
      variation: {
        include: {
          values: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' as const },
          },
        },
      },
    },
  },
  variants: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' as const },
  },
  relatedTo: {
    include: {
      relatedProduct: {
        select: { id: true, name: true, slug: true, images: true },
      },
    },
  },
  upSellTo: {
    include: {
      upSellProduct: {
        select: { id: true, name: true, slug: true, images: true },
      },
    },
  },
  crossSellTo: {
    include: {
      crossSellProduct: {
        select: { id: true, name: true, slug: true, images: true },
      },
    },
  },
};

// ─── Enhanced summary select for list mode ────────────────────
const PRODUCT_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  shortDescription: true,
  sku: true,
  price: true,
  specialPrice: true,
  specialPriceType: true,
  specialPriceStart: true,
  specialPriceEnd: true,
  images: true,
  inStock: true,
  isActive: true,
  newFrom: true,
  newTo: true,
  viewed: true,
  seo: true,
  createdAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, slug: true } },
  categories: {
    where: {
      category: {
        deletedAt: null,
      },
    },
    select: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
  variants: {
    where: { deletedAt: null },
    select: {
      id: true,
      uid: true,
      name: true,
      sku: true,
      price: true,
      specialPrice: true,
      specialPriceType: true,
      specialPriceStart: true,
      specialPriceEnd: true,
      inStock: true,
      isDefault: true,
      isActive: true,
      position: true,
      qty: true,
    },
    orderBy: { position: 'asc' as const },
  },
  _count: {
    select: {
      variants: { where: { deletedAt: null } },
      categories: true,
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

  // ─── Generate unique slug ───────────────────────────────────
  private async generateUniqueSlug(name: string): Promise<string> {
    let slug = slugify(name);
    if (!slug) slug = 'product';

    let candidate = slug;
    let counter = 0;

    while (true) {
      const exists = await this.prisma.product.findFirst({
        where: { slug: candidate, deletedAt: null },
        select: { id: true },
      });
      if (!exists) return candidate;
      counter++;
      candidate = `${slug}-${counter}`;
    }
  }

  // ─── Helper: Build sort order from query param ──────────────
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
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  // ─── Helper: Attach media to a single product ───────────────
  private async attachMedia(product: any): Promise<any> {
    const media = await this.mediaService.getEntityMedia({
      entityType: 'Product',
      entityId: product.id,
    });

    const variantsWithMedia = await Promise.all(
      (product.variants || []).map(async (variant: any) => {
        const variantMedia = await this.mediaService.getEntityMedia({
          entityType: 'ProductVariant',
          entityId: variant.id,
        });
        return { ...variant, media: variantMedia };
      }),
    );

    return {
      ...product,
      media,
      variants: variantsWithMedia,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE PRODUCT
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateProductDto, createdBy: string) {
    const slug = await this.generateUniqueSlug(dto.name);
    const hasVariants = !!(dto.variants && dto.variants.length > 0);

    // Check SKU uniqueness (global)
    if (!hasVariants && dto.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { sku: dto.sku, deletedAt: null },
        select: { id: true },
      });
      if (skuExists) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    // Check variant SKU uniqueness
    if (hasVariants && dto.variants) {
      for (const v of dto.variants) {
        if (v.sku) {
          const skuExists = await this.prisma.productVariant.findFirst({
            where: { sku: v.sku, deletedAt: null },
            select: { id: true },
          });
          if (skuExists) {
            throw new ConflictException(
              `Variant SKU "${v.sku}" already exists`,
            );
          }
        }
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      // ─── 1. Create Product ──────────────────────────────────
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          shortDescription: dto.shortDescription ?? null,
          brandId: dto.brandId ?? null,
          taxClassId: dto.taxClassId ?? null,
          isActive: dto.isActive ?? true,

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

          // SEO
          seo: dto.seo
            ? (dto.seo as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,

          // Additional
          newFrom: dto.newFrom ? new Date(dto.newFrom) : null,
          newTo: dto.newTo ? new Date(dto.newTo) : null,

          createdBy,
        },
      });

      // ─── 2. Link Categories ─────────────────────────────────
      if (dto.categoryIds && dto.categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            productId: product.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      // ─── 3. Link Tags ──────────────────────────────────────
      if (dto.tagIds && dto.tagIds.length > 0) {
        await tx.productTag.createMany({
          data: dto.tagIds.map((tagId) => ({
            productId: product.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      // ─── 4. Link Attributes ─────────────────────────────────
      if (dto.attributes && dto.attributes.length > 0) {
        for (const attr of dto.attributes) {
          const productAttribute = await tx.productAttribute.create({
            data: {
              productId: product.id,
              attributeId: attr.attributeId,
            },
          });

          if (attr.attributeValueIds && attr.attributeValueIds.length > 0) {
            await tx.productAttributeValue.createMany({
              data: attr.attributeValueIds.map((avId) => ({
                productAttributeId: productAttribute.id,
                attributeValueId: avId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      // ─── 5. Handle Variations ───────────────────────────────
      const variationValueMap: Map<string, string> = new Map();

      if (dto.variations && dto.variations.length > 0) {
        for (const varItem of dto.variations) {
          let variationId: string;

          if (varItem.variationId) {
            variationId = varItem.variationId;
          } else {
            const varUid = slugify(varItem.name) || 'variation';
            let candidateUid = varUid;
            let counter = 0;
            while (true) {
              const exists = await tx.variation.findFirst({
                where: { uid: candidateUid, deletedAt: null },
                select: { id: true },
              });
              if (!exists) break;
              counter++;
              candidateUid = `${varUid}-${counter}`;
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
                while (true) {
                  const exists = await tx.variationValue.findFirst({
                    where: { uid: valUid, deletedAt: null },
                    select: { id: true },
                  });
                  if (!exists) break;
                  valCounter++;
                  valUid = `${slugify(valUidBase)}-${valCounter}`;
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

          // If using existing variation, map its values
          if (varItem.variationId) {
            for (const val of varItem.values) {
              if (val.variationValueId) {
                variationValueMap.set(
                  `${varItem.name}:${val.label}`,
                  val.variationValueId,
                );
              }
            }
          }

          // Create ProductVariation junction
          await tx.productVariation.create({
            data: {
              productId: product.id,
              variationId,
            },
          });
        }
      }

      // ─── 6. Create Variants ─────────────────────────────────
      if (hasVariants && dto.variants) {
        for (let i = 0; i < dto.variants.length; i++) {
          const v = dto.variants[i];

          const uid = slugify(v.name) || `variant-${i}`;
          let candidateUid = uid;
          let counter = 0;
          while (true) {
            const exists = await tx.productVariant.findFirst({
              where: { uid: candidateUid, deletedAt: null },
              select: { id: true },
            });
            if (!exists) break;
            counter++;
            candidateUid = `${uid}-${counter}`;
          }

          // Build uids from variation value IDs
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
              productId: product.id,
              name: v.name,
              sku: v.sku ?? null,
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
              qty: v.qty != null ? v.qty : null,
              inStock: v.inStock ?? true,
              isDefault: v.isDefault ?? i === 0,
              isActive: v.isActive ?? true,
              position: v.position ?? i,
            },
          });

          // Link variant media via EntityMedia
          if (v.mediaIds && v.mediaIds.length > 0) {
            await tx.entityMedia.createMany({
              data: v.mediaIds.map((mediaId, idx) => ({
                entityType: 'ProductVariant',
                entityId: variant.id,
                mediaId,
                position: idx,
                purpose: 'gallery',
                isMain: idx === 0,
              })),
              skipDuplicates: true,
            });

            // Increment reference counts
            await tx.media.updateMany({
              where: { id: { in: v.mediaIds } },
              data: { referenceCount: { increment: 1 } },
            });
          }
        }
      }

      // ─── 7. Linked Products ─────────────────────────────────
      if (dto.relatedProductIds && dto.relatedProductIds.length > 0) {
        await tx.relatedProduct.createMany({
          data: dto.relatedProductIds.map((relId, idx) => ({
            productId: product.id,
            relatedProductId: relId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.upSellProductIds && dto.upSellProductIds.length > 0) {
        await tx.upSellProduct.createMany({
          data: dto.upSellProductIds.map((upId, idx) => ({
            productId: product.id,
            upSellProductId: upId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.crossSellProductIds && dto.crossSellProductIds.length > 0) {
        await tx.crossSellProduct.createMany({
          data: dto.crossSellProductIds.map((csId, idx) => ({
            productId: product.id,
            crossSellProductId: csId,
            position: idx,
          })),
          skipDuplicates: true,
        });
      }

      return product;
    });

    // ─── 8. Link Global Media via EntityMedia (outside tx) ────
    if (!hasVariants && dto.mediaIds && dto.mediaIds.length > 0) {
      await this.mediaService.linkMediaToEntity({
        entityType: 'Product',
        entityId: product.id,
        mediaIds: dto.mediaIds,
        purpose: 'gallery',
        mainMediaId: dto.mainMediaId,
      });
    }

    this.logger.log(`Product created: ${slug} by ${createdBy}`);
    return this.findOne(product.id);
  }

  // ══════════════════════════════════════════════════════════════
  // LIST PRODUCTS (supports summary & detail modes)
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,

      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' as const } },
          { sku: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),

      ...(dto.brandId && {
        brandId: dto.brandId,
      }),

      ...(dto.isActive !== undefined && {
        isActive: dto.isActive,
      }),

      ...(dto.inStock !== undefined && {
        inStock: dto.inStock,
      }),

      ...(dto.categoryId && {
        categories: {
          some: {
            categoryId: dto.categoryId,
          },
        },
      }),

      ...(dto.tagId && {
        tags: {
          some: {
            tagId: dto.tagId,
          },
        },
      }),

      // Price range filter
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

    // ─── DETAIL MODE ─────────────────────────
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

      const data = await Promise.all(
        products.map((product) => this.attachMedia(product)),
      );

      return {
        data,
        total,
        meta: {
          skip: dto.skip,
          take: dto.take,
          page: Math.floor(dto.skip / dto.take) + 1,
          pageCount: Math.ceil(total / dto.take) || 1,
        },
      };
    }

    // ─── SUMMARY MODE ───────────────────────
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SUMMARY_SELECT,
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
        pageCount: Math.ceil(total / dto.take) || 1,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET SINGLE PRODUCT BY ID (includes media from EntityMedia)
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_FULL_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment view count (fire and forget)
    this.prisma.product
      .update({
        where: { id },
        data: { viewed: { increment: 1 } },
      })
      .catch(() => {});

    return this.attachMedia(product);
  }

  // ══════════════════════════════════════════════════════════════
  // GET SINGLE PRODUCT BY SLUG (for frontend SEO-friendly URLs)
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: PRODUCT_FULL_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment view count (fire and forget)
    this.prisma.product
      .update({
        where: { id: product.id },
        data: { viewed: { increment: 1 } },
      })
      .catch(() => {});

    return this.attachMedia(product);
  }

  // ══════════════════════════════════════════════════════════════
  // GET PRODUCTS BY CATEGORY SLUG (for storefront category pages)
  // ══════════════════════════════════════════════════════════════
  async findByCategorySlug(categorySlug: string, dto: ListProductsDto) {
    const category = await this.prisma.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Override categoryId in dto and delegate to findAll
    dto.categoryId = category.id;
    return this.findAll(dto);
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE PRODUCT
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true, sku: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const hasVariants = !!(dto.variants && dto.variants.length > 0);

    if (!hasVariants && dto.sku && dto.sku !== existing.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { sku: dto.sku, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (skuExists) {
        throw new ConflictException('Product with this SKU already exists');
      }
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

          ...(dto.seo !== undefined && {
            seo: dto.seo
              ? (dto.seo as unknown as Prisma.InputJsonValue)
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
        if (dto.categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: dto.categoryIds.map((catId) => ({
              productId: id,
              categoryId: catId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Sync Tags
      if (dto.tagIds !== undefined) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        if (dto.tagIds.length > 0) {
          await tx.productTag.createMany({
            data: dto.tagIds.map((tagId) => ({
              productId: id,
              tagId,
            })),
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

        if (dto.attributes.length > 0) {
          for (const attr of dto.attributes) {
            const pa = await tx.productAttribute.create({
              data: { productId: id, attributeId: attr.attributeId },
            });
            if (attr.attributeValueIds.length > 0) {
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
      }

      // Sync Linked Products
      if (dto.relatedProductIds !== undefined) {
        await tx.relatedProduct.deleteMany({ where: { productId: id } });
        if (dto.relatedProductIds.length > 0) {
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
        if (dto.upSellProductIds.length > 0) {
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
        if (dto.crossSellProductIds.length > 0) {
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
      await this.mediaService.updateEntityMedia({
        entityType: 'Product',
        entityId: id,
        mediaIds: dto.mediaIds,
        purpose: 'gallery',
        mainMediaId: dto.mainMediaId,
      });
    }

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

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.productVariant.updateMany({
      where: { productId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy },
    });

    await this.prisma.softDelete('product', id, deletedBy);
    this.logger.log(`Product deleted: ${product.slug} by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // SEARCH PRODUCTS (for linked product dropdowns)
  // ══════════════════════════════════════════════════════════════
  async search(query: string) {
    if (!query || query.length < 2) return [];

    return this.prisma.product.findMany({
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
        images: true,
        price: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // BULK EDIT VARIANTS
  // ══════════════════════════════════════════════════════════════
  async bulkEditVariants(productId: string, dto: BulkEditVariantDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

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

    this.logger.log(
      `Bulk edit variants: ${dto.field}=${dto.value} for product ${productId}`,
    );
    return this.findOne(productId);
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE SINGLE VARIANT
  // ══════════════════════════════════════════════════════════════
  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    updatedBy: string,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, deletedAt: null },
      select: { id: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (dto.sku) {
      const skuExists = await this.prisma.productVariant.findFirst({
        where: { sku: dto.sku, deletedAt: null, id: { not: variantId } },
        select: { id: true },
      });
      if (skuExists) {
        throw new ConflictException(`Variant SKU "${dto.sku}" already exists`);
      }
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
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
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.position !== undefined && { position: dto.position }),
      },
    });

    // Update variant media via EntityMedia
    if (dto.mediaIds !== undefined) {
      await this.mediaService.updateEntityMedia({
        entityType: 'ProductVariant',
        entityId: variantId,
        mediaIds: dto.mediaIds,
        purpose: 'gallery',
      });
    }

    this.logger.log(`Variant updated: ${variantId} by ${updatedBy}`);
    return this.findOne(productId);
  }
}
