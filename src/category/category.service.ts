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
} from './dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════
  // HELPER: Build materialized path
  // ══════════════════════════════════════════════════════════════
  private async buildPath(parentId: string | null): Promise<{
    path: string;
    pathIds: string;
    depth: number;
  }> {
    if (!parentId) {
      return { path: '', pathIds: '', depth: 0 };
    }

    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, slug: true, path: true, pathIds: true, depth: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent category not found');
    }

    const path = parent.path ? `${parent.path}/${parent.slug}` : parent.slug;
    const pathIds = parent.pathIds
      ? `${parent.pathIds},${parent.id}`
      : parent.id;
    const depth = parent.depth + 1;

    return { path, pathIds, depth };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER: Update descendant paths
  // ══════════════════════════════════════════════════════════════
  private async updateDescendantPaths(
    categoryId: string,
    newPath: string,
    newPathIds: string,
    newDepth: number,
  ): Promise<void> {
    // Get the category being moved
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true, pathIds: true },
    });

    if (!category) return;

    // Find all descendants using raw SQL for string pattern matching
    const descendants = await this.prisma.$queryRaw<
      Array<{
        id: string;
        pathIds: string | null;
        slug: string;
      }>
    >`
      SELECT id, path_ids as "pathIds", slug
      FROM categories
      WHERE deleted_at IS NULL
        AND id != ${categoryId}
        AND (
          path_ids LIKE ${categoryId + ',%'}
          OR path_ids LIKE ${'%,' + categoryId + ',%'}
          OR path_ids LIKE ${'%,' + categoryId}
          OR path_ids = ${categoryId}
        )
    `;

    // Update each descendant
    for (const descendant of descendants) {
      if (!descendant.pathIds) continue;

      const oldPathIdsArray = descendant.pathIds.split(',');
      const newPathIdsArray = newPathIds ? newPathIds.split(',') : [];

      // Find where the moved category appears in old path
      const movedIndex = oldPathIdsArray.indexOf(categoryId);

      if (movedIndex !== -1) {
        // Replace the path up to and including the moved category
        const remainingPath = oldPathIdsArray.slice(movedIndex + 1);
        const updatedPathIds = [
          ...newPathIdsArray,
          categoryId,
          ...remainingPath,
        ].join(',');

        // Build slug path
        const pathSegments: string[] = [];
        for (const id of updatedPathIds.split(',')) {
          const cat = await this.prisma.category.findUnique({
            where: { id },
            select: { slug: true },
          });
          if (cat) pathSegments.push(cat.slug);
        }

        const updatedPath = pathSegments.join('/');
        const updatedDepth = updatedPathIds.split(',').length;

        await this.prisma.category.update({
          where: { id: descendant.id },
          data: {
            path: updatedPath,
            pathIds: updatedPathIds,
            depth: updatedDepth,
          },
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CREATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async create(dto: CreateCategoryDto, createdBy: string): Promise<object> {
    // Check slug uniqueness
    const existingSlug = await this.prisma.category.findFirst({
      where: { slug: dto.slug, deletedAt: null },
      select: { id: true },
    });

    if (existingSlug) {
      throw new ConflictException('Category with this slug already exists');
    }

    // Check parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, deletedAt: null },
        select: { id: true },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    // Build materialized path
    const { path, pathIds, depth } = await this.buildPath(dto.parentId || null);

    // Verify media exists if provided
    if (dto.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('Invalid image media ID');
    }

    if (dto.icon) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.icon, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('Invalid icon media ID');
    }

    // Create category
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description || null,
        parentId: dto.parentId || null,
        image: dto.image || null,
        icon: dto.icon || null,
        position: dto.position || 0,
        depth,
        path,
        pathIds,
        isActive: dto.isActive ?? true,
        translations: dto.translations
          ? (dto.translations as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        seo: dto.seo ? (dto.seo as Prisma.InputJsonValue) : Prisma.JsonNull,
        createdBy,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    // Link media
    if (dto.image) {
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Category',
          entityId: category.id,
          mediaId: dto.image,
          purpose: 'thumbnail',
          isMain: true,
        },
      });

      await this.prisma.media.update({
        where: { id: dto.image },
        data: { referenceCount: { increment: 1 } },
      });
    }

    if (dto.icon) {
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Category',
          entityId: category.id,
          mediaId: dto.icon,
          purpose: 'icon',
        },
      });

      await this.prisma.media.update({
        where: { id: dto.icon },
        data: { referenceCount: { increment: 1 } },
      });
    }

    this.logger.log(`Category created: ${category.slug} by ${createdBy}`);
    return category;
  }

  // ══════════════════════════════════════════════════════════════
  // GET ALL CATEGORIES
  // ══════════════════════════════════════════════════════════════
  async findAll(dto: ListCategoriesDto): Promise<{
    data: object[];
    total: number;
    meta: object;
  }> {
    const where: any = {
      deletedAt: null,
    };

    // Search filter
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' as const } },
        { slug: { contains: dto.search, mode: 'insensitive' as const } },
      ];
    }

    // Parent filter
    if (dto.parentId) {
      where.parentId = dto.parentId;
    } else if (dto.rootOnly) {
      where.parentId = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          icon: true,
          parentId: true,
          position: true,
          depth: true,
          path: true,
          isActive: true,
          translations: true,
          seo: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              children: true,
              products: true,
            },
          },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        skip: dto.skip,
        take: dto.take,
      }),
      this.prisma.category.count({ where }),
    ]);

    // If tree structure requested, build hierarchy
    if (dto.tree && dto.rootOnly) {
      const tree = await this.buildTree(data as any[]);
      return {
        data: tree,
        total,
        meta: {
          skip: dto.skip,
          take: dto.take,
          page: Math.floor(dto.skip / dto.take) + 1,
          pageCount: Math.ceil(total / dto.take),
        },
      };
    }

    return {
      data,
      total,
      meta: {
        skip: dto.skip,
        take: dto.take,
        page: Math.floor(dto.skip / dto.take) + 1,
        pageCount: Math.ceil(total / dto.take),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // BUILD TREE STRUCTURE
  // ══════════════════════════════════════════════════════════════
  private async buildTree(categories: any[]): Promise<any[]> {
    const categoryMap = new Map();
    const roots: any[] = [];

    // First pass: create map
    for (const cat of categories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    // Second pass: build tree
    for (const cat of categories) {
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      } else {
        roots.push(categoryMap.get(cat.id));
      }
    }

    // Recursively load children for each root
    for (const root of roots) {
      await this.loadChildren(root);
    }

    return roots;
  }

  // Load children recursively
  private async loadChildren(category: any): Promise<void> {
    const children = await this.prisma.category.findMany({
      where: {
        parentId: category.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        icon: true,
        parentId: true,
        position: true,
        depth: true,
        path: true,
        isActive: true,
        translations: true,
        createdAt: true,
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    category.children = children;

    // Recursively load children's children
    for (const child of children) {
      await this.loadChildren(child);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY ID
  // ══════════════════════════════════════════════════════════════
  async findOne(id: string): Promise<object> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            position: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Get media
    const media = await this.prisma.entityMedia.findMany({
      where: {
        entityType: 'Category',
        entityId: id,
      },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
          },
        },
      },
    });

    // Get breadcrumbs from path
    const breadcrumbs = await this.getBreadcrumbs(category.pathIds);

    return { ...category, media, breadcrumbs };
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY BY SLUG
  // ══════════════════════════════════════════════════════════════
  async findBySlug(slug: string): Promise<object> {
    const category = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            position: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Get media
    const media = await this.prisma.entityMedia.findMany({
      where: {
        entityType: 'Category',
        entityId: category.id,
      },
      include: {
        media: {
          select: {
            id: true,
            storageUrl: true,
            variants: true,
            alt: true,
          },
        },
      },
    });

    // Get breadcrumbs
    const breadcrumbs = await this.getBreadcrumbs(category.pathIds);

    return { ...category, media, breadcrumbs };
  }

  // ══════════════════════════════════════════════════════════════
  // GET BREADCRUMBS
  // ══════════════════════════════════════════════════════════════
  private async getBreadcrumbs(pathIds: string | null): Promise<any[]> {
    if (!pathIds) return [];

    const ids = pathIds.split(',').filter(Boolean);
    if (ids.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    // Order by pathIds order
    return ids
      .map((id) => categories.find((cat) => cat.id === id))
      .filter(Boolean);
  }

  // ══════════════════════════════════════════════════════════════
  // UPDATE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async update(
    id: string,
    dto: UpdateCategoryDto,
    updatedBy: string,
  ): Promise<object> {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        image: true,
        icon: true,
        parentId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.category.findFirst({
        where: { slug: dto.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });

      if (slugExists) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    // Verify media if changing
    if (dto.image && dto.image !== existing.image) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.image, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('Invalid image media ID');
    }

    if (dto.icon && dto.icon !== existing.icon) {
      const media = await this.prisma.media.findFirst({
        where: { id: dto.icon, deletedAt: null },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('Invalid icon media ID');
    }

    // Update category
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
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

    // Update media relationships if changed
    if (dto.image && dto.image !== existing.image) {
      // Remove old
      if (existing.image) {
        await this.prisma.entityMedia.deleteMany({
          where: {
            entityType: 'Category',
            entityId: id,
            purpose: 'thumbnail',
          },
        });
        await this.prisma.media.update({
          where: { id: existing.image },
          data: { referenceCount: { decrement: 1 } },
        });
      }

      // Add new
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Category',
          entityId: id,
          mediaId: dto.image,
          purpose: 'thumbnail',
          isMain: true,
        },
      });
      await this.prisma.media.update({
        where: { id: dto.image },
        data: { referenceCount: { increment: 1 } },
      });
    }

    if (dto.icon && dto.icon !== existing.icon) {
      // Remove old
      if (existing.icon) {
        await this.prisma.entityMedia.deleteMany({
          where: {
            entityType: 'Category',
            entityId: id,
            purpose: 'icon',
          },
        });
        await this.prisma.media.update({
          where: { id: existing.icon },
          data: { referenceCount: { decrement: 1 } },
        });
      }

      // Add new
      await this.prisma.entityMedia.create({
        data: {
          entityType: 'Category',
          entityId: id,
          mediaId: dto.icon,
          purpose: 'icon',
        },
      });
      await this.prisma.media.update({
        where: { id: dto.icon },
        data: { referenceCount: { increment: 1 } },
      });
    }

    // If slug changed, update paths of all descendants
    if (dto.slug && dto.slug !== existing.slug) {
      const { path, pathIds, depth } = await this.buildPath(category.parentId);
      await this.prisma.category.update({
        where: { id },
        data: { path, pathIds, depth },
      });
      await this.updateDescendantPaths(id, path, pathIds, depth);
    }

    this.logger.log(`Category updated: ${category.slug} by ${updatedBy}`);
    return category;
  }

  // ══════════════════════════════════════════════════════════════
  // MOVE CATEGORY
  // ══════════════════════════════════════════════════════════════
  async move(
    id: string,
    dto: MoveCategoryDto,
    updatedBy: string,
  ): Promise<object> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        parentId: true,
        pathIds: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Prevent moving to itself or its own descendant
    if (dto.newParentId === id) {
      throw new BadRequestException('Cannot move category to itself');
    }

    if (dto.newParentId && category.pathIds) {
      const pathIdsArray = category.pathIds.split(',');
      if (pathIdsArray.includes(dto.newParentId)) {
        throw new BadRequestException(
          'Cannot move category to its own descendant',
        );
      }
    }

    // Check new parent exists
    if (dto.newParentId) {
      const newParent = await this.prisma.category.findFirst({
        where: { id: dto.newParentId, deletedAt: null },
        select: { id: true },
      });

      if (!newParent) {
        throw new NotFoundException('New parent category not found');
      }
    }

    // Build new path
    const { path, pathIds, depth } = await this.buildPath(
      dto.newParentId || null,
    );

    // Update category
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

    // Update all descendants
    await this.updateDescendantPaths(id, path, pathIds, depth);

    this.logger.log(`Category moved: ${id} by ${updatedBy}`);

    return this.findOne(id);
  }

  // ══════════════════════════════════════════════════════════════
  // DELETE CATEGORY (SOFT DELETE WITH DESCENDANTS)
  // ══════════════════════════════════════════════════════════════
  async remove(id: string, deletedBy: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        pathIds: true,
        image: true,
        icon: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if has products
    const productCount = await this.prisma.productCategory.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category. ${productCount} products are using this category`,
      );
    }

    // Find all descendants using raw SQL
    const descendantIds = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM categories
      WHERE deleted_at IS NULL
        AND (
          path_ids LIKE ${id + ',%'}
          OR path_ids LIKE ${'%,' + id + ',%'}
          OR path_ids LIKE ${'%,' + id}
          OR path_ids = ${id}
        )
    `;

    const idsToDelete = [id, ...descendantIds.map((d) => d.id)];

    // Soft delete this category and all descendants
    await this.prisma.category.updateMany({
      where: {
        id: { in: idsToDelete },
      },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });

    // Remove media relationships
    if (category.image) {
      await this.prisma.entityMedia.deleteMany({
        where: {
          entityType: 'Category',
          entityId: id,
          purpose: 'thumbnail',
        },
      });
      await this.prisma.media.update({
        where: { id: category.image },
        data: { referenceCount: { decrement: 1 } },
      });
    }

    if (category.icon) {
      await this.prisma.entityMedia.deleteMany({
        where: {
          entityType: 'Category',
          entityId: id,
          purpose: 'icon',
        },
      });
      await this.prisma.media.update({
        where: { id: category.icon },
        data: { referenceCount: { decrement: 1 } },
      });
    }

    this.logger.log(`Category deleted: ${category.slug} by ${deletedBy}`);
  }

  // ══════════════════════════════════════════════════════════════
  // GET CATEGORY TREE (Full hierarchy)
  // ══════════════════════════════════════════════════════════════
  async getTree(): Promise<any[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        deletedAt: null,
        parentId: null, // Start with roots
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        icon: true,
        position: true,
        depth: true,
        isActive: true,
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    // Load children for each root
    for (const cat of categories) {
      await this.loadChildren(cat);
    }

    return categories;
  }
}
