// ─── src/admin/dto/update-admin-permissions.dto.ts ──────────
import { IsEnum, IsArray, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminPermission } from '@prisma/client';

export class UpdateAdminPermissionsDto {
  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description: 'Permissions to ADD to existing set',
    example: ['PRODUCT_CREATE', 'ORDER_READ'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  add?: AdminPermission[];

  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description: 'Permissions to REMOVE from existing set',
    example: ['FINANCE_VIEW'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  remove?: AdminPermission[];

  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description:
      'REPLACE all permissions with this exact set (overrides add/remove)',
    example: ['PRODUCT_READ', 'ORDER_READ', 'INVENTORY_VIEW'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  set?: AdminPermission[];
}
