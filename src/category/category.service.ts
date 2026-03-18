// ─── src/category/category.service.ts ────────────────────────

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesDto,
  MoveCategoryDto,
  ReorderCategoriesDto,
} from './dto';

const MAX_DEPTH = 5;

// Select shape for category list items
const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  icon: true,
  bannerImage: true,
  parentId: true,
  path: true,
  pathIds: true,
  depth: true,
  position: true,
  isActive: true,
  translations: true,
  seo: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { children: true, products: true } },
} as const;

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // HELPER: Build materialized path from parent
  // ══════════════════════════════════════════════════════════════
  private async buildPath(
    parentId: string | null,
    newSlug: string,
  ): Promise<{ path: string; pathIds: string; depth: number }> {
    if (!parentId) {
      return { path: newSlug, pathIds: '', depth: 0 };
    }

    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, slug: true, path: true, pathIds: true, depth: true },
    });

    if (!parent)
      throw new NotFoundException({
        message: 'Parent category not found',
        parentId,
      });

    const depth = parent.depth + 1;
    if (depth > MAX_DEPTH) {
      throw new BadRequestException({
        message: `Maximum category depth of ${MAX_DEPTH} exceeded`,
        currentDepth: depth,
        maxDepth: MAX_DEPTH,
      });
    }

    const path = `${parent.path}/${newSlug}`;
    const pathIds = parent.pathIds
      ? `${parent.pathIds},${parent.id}`
      : parent.id;

    return { path, pathIds, depth };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Rebuild paths for all descendants after move/slug change
  // ══════════════════════════════════════════════════════════════
  private async rebuildDescendantPaths(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, slug: true, path: true, pathIds: true, depth: true },
    });
    if (!category) return;

    // Find all direct children
    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId, deletedAt: null },
      select: { id: true, slug: true },
    });

    for (const child of children) {
      const newPath = `${category.path}/${child.slug}`;
      const newPathIds = category.pathIds
        ? `${category.pathIds},${category.id}`
        : category.id;
      const newDepth = category.depth + 1;

      await this.prisma.category.update({
        where: { id: child.id },
        data: { path: newPath, pathIds: newPathIds, depth: newDepth },
      });

      // Recurse into child
      await this.rebuildDescendantPaths(child.id);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Get all descendant IDs using raw SQL
  // ══════════════════════════════════════════════════════════════
  private async getDescendantIds(categoryId: string): Promise<string[]> {
    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM categories
      WHERE deleted_at IS NULL
        AND (
          path_ids = ${categoryId}
          OR path_ids LIKE ${categoryId + ',%'}
          OR path_ids LIKE ${'%,' + categoryId + ',%'}
          OR path_ids LIKE ${'%,' + categoryId}
        )
    `;
    return result.map((r) => r.id);
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Link/unlink media
  // ══════════════════════════════════════════════════════════════
  private async linkMedia(
    tx: any,
    entityId: string,
    mediaId: string,
    purpose: string,
    isMain = false,
  ) {
    await tx.entityMedia.upsert({
      where: {
        entityType_entityId_mediaId: {
          entityType: 'Category',
          entityId,
          mediaId,
        },
      },
      create: { entityType: 'Category', entityId, mediaId, purpose, isMain },
      update: { purpose, isMain },
    });
    await tx.media.update({
      where: { id: mediaId },
      data: { referenceCount: { increment: 1 } },
    });
  }

  private async unlinkMedia(
    tx: any,
    entityId: string,
    mediaId: string,
    purpose: string,
  ) {
    const deleted = await tx.entityMedia.deleteMany({
      where: { entityType: 'Category', entityId, mediaId, purpose },
    });
    if (deleted.count > 0) {
      await tx.media.updateMany({
        where: { id: mediaId, referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Verify media IDs
  // ══════════════════════════════════════════════════════════════
  private async verifyMedia(mediaId: string, field: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
      select: { id: true },
    });
    if (!media)
      throw new BadRequestException({
        message: `Media not found for "${field}"`,
        field,
        mediaId,
      });
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Load breadcrumbs from pathIds string
  // ══════════════════════════════════════════════════════════════
  private async loadBreadcrumbs(pathIds: string | null): Promise<any[]> {
    if (!pathIds) return [];
    const ids = pathIds.split(',').filter(Boolean);
    if (ids.length === 0) return [];

    const cats = await this.prisma.category.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, slug: true, image: true },
    });

    return ids.map((id) => cats.find((c) => c.id === id)).filter(Boolean);
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Recursively load children for tree
  // ══════════════════════════════════════════════════════════════
  private async loadChildren(
    category: any,
    activeOnly: boolean,
  ): Promise<void> {
    const children = await this.prisma.category.findMany({
      where: {
        parentId: category.id,
        deletedAt: null,
        ...(activeOnly && { isActive: true }),
      },
      select: CATEGORY_SELECT,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    category.children = children;
    for (const child of children) {
      await this.loadChildren(child, activeOnly);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateCategoryDto, createdBy: string) {
    // Slug uniqueness
    const existingSlug = await this.prisma.category.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException({
        message: 'Category with this slug already exists',
        field: 'slug',
        conflictingId: existingSlug.id,
      });
    }

    // Verify media
    if (dto.image) await this.verifyMedia(dto.image, 'image');
    if (dto.icon) await this.verifyMedia(dto.icon, 'icon');
    if (dto.bannerImage) await this.verifyMedia(dto.bannerImage, 'bannerImage');

    // Build path
    const { path, pathIds, depth } = await this.buildPath(
      dto.parentId || null,
      dto.slug,
    );

    const category = await this.prisma.$transaction(async (tx) => {
      const cat = await tx.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          parentId: dto.parentId || null,
          image: dto.image || null,
          icon: dto.icon || null,
          bannerImage: dto.bannerImage || null,
          path,
          pathIds,
          depth,
          position: dto.position ?? 0,
          isActive: dto.isActive ?? true,
          translations: dto.translations
            ? (dto.translations as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          seo: dto.seo ? (dto.seo as Prisma.InputJsonValue) : Prisma.JsonNull,
          createdBy,
        },
      });

      if (dto.image)
        await this.linkMedia(tx, cat.id, dto.image, 'thumbnail', true);
      if (dto.icon) await this.linkMedia(tx, cat.id, dto.icon, 'icon');
      if (dto.bannerImage)
        await this.linkMedia(tx, cat.id, dto.bannerImage, 'banner');

      return cat;
    });

    this.logger.log(
      `Category created: "${category.name}" (${category.slug}) depth=${depth} by ${createdBy}`,
    );
    return this.findOne(category.id);
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL CATEGORIES (flat list)
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListCategoriesDto) {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { slug: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...(dto.parentId
        ? { parentId: dto.parentId }
        : dto.rootOnly
          ? { parentId: null }
          : {}),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const sortField = dto.sortBy ?? 'position';
    const sortDir = dto.sortOrder ?? 'asc';

    const orderByMap: Record<string, Prisma.CategoryOrderByWithRelationInput> =
      {
        name: { name: sortDir },
        slug: { slug: sortDir },
        position: { position: sortDir },
        createdAt: { createdAt: sortDir },
        depth: { depth: sortDir },
      };
    const orderBy = orderByMap[sortField] ?? { position: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        select: {
          ...CATEGORY_SELECT,
          parent: { select: { id: true, name: true, slug: true } },
        },
        orderBy,
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.category.count({ where }),
    ]);

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
  // GET FULL TREE
  // ══════════════════════════════════════════════════════════════
  async getTree(activeOnly: boolean = false) {
    const roots = await this.prisma.category.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        ...(activeOnly && { isActive: true }),
      },
      select: CATEGORY_SELECT,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    for (const root of roots) {
      await this.loadChildren(root as any, activeOnly);
    }

    return roots;
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...CATEGORY_SELECT,
        createdBy: true,
        updatedBy: true,
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            icon: true,
            position: true,
            isActive: true,
            depth: true,
            _count: { select: { children: true, products: true } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
        resource: 'Category',
      });
    }

    const [breadcrumbs, media] = await Promise.all([
      this.loadBreadcrumbs(category.pathIds),
      this.prisma.entityMedia.findMany({
        where: { entityType: 'Category', entityId: id },
        include: {
          media: {
            select: {
              id: true,
              storageUrl: true,
              variants: true,
              alt: true,
              mimeType: true,
            },
          },
        },
        orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
      }),
    ]);

    return { ...category, breadcrumbs, media };
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug: slug.toLowerCase(), deletedAt: null },
      select: {
        ...CATEGORY_SELECT,
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            icon: true,
            position: true,
            isActive: true,
            _count: { select: { children: true, products: true } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceSlug: slug,
        resource: 'Category',
      });
    }

    const [breadcrumbs, media] = await Promise.all([
      this.loadBreadcrumbs(category.pathIds),
      this.prisma.entityMedia.findMany({
        where: { entityType: 'Category', entityId: category.id },
        include: {
          media: {
            select: {
              id: true,
              storageUrl: true,
              variants: true,
              alt: true,
              mimeType: true,
            },
          },
        },
        orderBy: [{ isMain: 'desc' }, { position: 'asc' }],
      }),
    ]);

    return { ...category, breadcrumbs, media };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BREADCRUMBS (by ID)
  // ══════════════════════════════════════════════════════════════
  async getBreadcrumbs(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, pathIds: true },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    const ancestors = await this.loadBreadcrumbs(category.pathIds);
    return [
      ...ancestors,
      { id: category.id, name: category.name, slug: category.slug },
    ];
  }

  // ══════════════════════════════════════════════════════════════
  // GET ANCESTORS
  // ══════════════════════════════════════════════════════════════
  async getAncestors(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pathIds: true },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    return this.loadBreadcrumbs(category.pathIds);
  }

  // ══════════════════════════════════════════════════════════════
  // GET DESCENDANTS (flat list)
  // ══════════════════════════════════════════════════════════════
  async getDescendants(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    const ids = await this.getDescendantIds(id);
    if (ids.length === 0) return [];

    return this.prisma.category.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: CATEGORY_SELECT,
      orderBy: [{ depth: 'asc' }, { position: 'asc' }],
    });
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY STATS (admin)
  // ══════════════════════════════════════════════════════════════
  async getStats(id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, depth: true, path: true },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    const descendantIds = await this.getDescendantIds(id);
    const allIds = [id, ...descendantIds];

    const [directProducts, totalProducts, childCount, descendantCount] =
      await Promise.all([
        this.prisma.productCategory.count({ where: { categoryId: id } }),
        this.prisma.productCategory.count({
          where: { categoryId: { in: allIds } },
        }),
        this.prisma.category.count({
          where: { parentId: id, deletedAt: null },
        }),
        Promise.resolve(descendantIds.length),
      ]);

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        depth: category.depth,
        path: category.path,
      },
      stats: { directProducts, totalProducts, childCount, descendantCount },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async update(id: string, dto: UpdateCategoryDto, updatedBy: string) {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        image: true,
        icon: true,
        bannerImage: true,
        parentId: true,
        path: true,
        pathIds: true,
        depth: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    // Slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.category.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (slugExists) {
        throw new ConflictException({
          message: 'Category slug already exists',
          field: 'slug',
          conflictingId: slugExists.id,
        });
      }
    }

    // Verify media
    if (dto.image && dto.image !== existing.image)
      await this.verifyMedia(dto.image, 'image');
    if (dto.icon && dto.icon !== existing.icon)
      await this.verifyMedia(dto.icon, 'icon');
    if (dto.bannerImage && dto.bannerImage !== existing.bannerImage)
      await this.verifyMedia(dto.bannerImage, 'bannerImage');

    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.image !== undefined && { image: dto.image }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.bannerImage !== undefined && {
            bannerImage: dto.bannerImage,
          }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.translations !== undefined && {
            translations: dto.translations as Prisma.InputJsonValue,
          }),
          ...(dto.seo !== undefined && {
            seo: dto.seo ? (dto.seo as Prisma.InputJsonValue) : Prisma.JsonNull,
          }),
          updatedBy,
        },
      });

      // Update image media
      if (dto.image !== undefined && dto.image !== existing.image) {
        if (existing.image)
          await this.unlinkMedia(tx, id, existing.image, 'thumbnail');
        if (dto.image)
          await this.linkMedia(tx, id, dto.image, 'thumbnail', true);
      }
      if (dto.icon !== undefined && dto.icon !== existing.icon) {
        if (existing.icon)
          await this.unlinkMedia(tx, id, existing.icon, 'icon');
        if (dto.icon) await this.linkMedia(tx, id, dto.icon, 'icon');
      }
      if (
        dto.bannerImage !== undefined &&
        dto.bannerImage !== existing.bannerImage
      ) {
        if (existing.bannerImage)
          await this.unlinkMedia(tx, id, existing.bannerImage, 'banner');
        if (dto.bannerImage)
          await this.linkMedia(tx, id, dto.bannerImage, 'banner');
      }
    });

    // If slug changed → rebuild all descendant paths
    if (dto.slug && dto.slug !== existing.slug) {
      const { path, pathIds, depth } = await this.buildPath(
        existing.parentId,
        dto.slug,
      );
      await this.prisma.category.update({
        where: { id },
        data: { path, pathIds, depth },
      });
      await this.rebuildDescendantPaths(id);
    }

    this.logger.log(`Category updated: "${existing.name}" by ${updatedBy}`);
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // MOVE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async move(id: string, dto: MoveCategoryDto, updatedBy: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        pathIds: true,
        parentId: true,
      },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    // Prevent moving to itself
    if (dto.newParentId === id) {
      throw new BadRequestException({
        message: 'Cannot move a category into itself',
      });
    }

    // Prevent moving to own descendant
    if (dto.newParentId) {
      const descendantIds = await this.getDescendantIds(id);
      if (descendantIds.includes(dto.newParentId)) {
        throw new BadRequestException({
          message: 'Cannot move a category into one of its own descendants',
        });
      }

      const newParent = await this.prisma.category.findFirst({
        where: { id: dto.newParentId, deletedAt: null },
        select: { id: true },
      });
      if (!newParent) {
        throw new NotFoundException({
          message: 'New parent category not found',
          parentId: dto.newParentId,
        });
      }
    }

    // Build new path
    const { path, pathIds, depth } = await this.buildPath(
      dto.newParentId || null,
      category.slug,
    );

    await this.prisma.category.update({
      where: { id },
      data: {
        parentId: dto.newParentId || null,
        path,
        pathIds,
        depth,
        position: dto.position ?? 0,
        updatedBy,
      },
    });

    // Rebuild all descendants
    await this.rebuildDescendantPaths(id);

    this.logger.log(
      `Category moved: "${category.name}" to parent=${dto.newParentId ?? 'root'} by ${updatedBy}`,
    );
    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // REORDER CATEGORIES (within same parent)
  // ══════════════════════════════════════════════════════════════
  async reorder(dto: ReorderCategoriesDto, updatedBy: string) {
    const updates = dto.items.map((item) =>
      this.prisma.category.update({
        where: { id: item.id },
        data: { position: item.position, updatedBy },
      }),
    );

    await this.prisma.$transaction(updates);
    this.logger.log(
      `Categories reordered within parent=${dto.parentId ?? 'root'} by ${updatedBy}`,
    );
    return { reordered: dto.items.length };
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE CATEGORY (SOFT + descendants)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        image: true,
        icon: true,
        bannerImage: true,
      },
    });

    if (!category) {
      throw new NotFoundException({
        message: 'Category not found',
        resourceId: id,
      });
    }

    // Check if category or any descendant has products
    const descendantIds = await this.getDescendantIds(id);
    const allIds = [id, ...descendantIds];

    const productCount = await this.prisma.productCategory.count({
      where: { categoryId: { in: allIds } },
    });

    if (productCount > 0) {
      throw new BadRequestException({
        message: `Cannot delete category "${category.name}". It (or its descendants) has ${productCount} product(s). Reassign products first.`,
        productCount,
        affectedCategories: allIds.length,
      });
    }

    // Soft delete category + all descendants
    await this.prisma.category.updateMany({
      where: { id: { in: allIds } },
      data: { deletedAt: new Date(), deletedBy },
    });

    // Unlink media
    if (category.image)
      await this.unlinkMedia(this.prisma, id, category.image, 'thumbnail');
    if (category.icon)
      await this.unlinkMedia(this.prisma, id, category.icon, 'icon');
    if (category.bannerImage)
      await this.unlinkMedia(this.prisma, id, category.bannerImage, 'banner');

    this.logger.log(
      `Category deleted: "${category.name}" + ${descendantIds.length} descendants by ${deletedBy}`,
    );
  }
}
