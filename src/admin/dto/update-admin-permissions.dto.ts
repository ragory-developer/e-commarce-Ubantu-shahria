import { IsEnum, IsArray, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminPermission } from '@prisma/client';

export class UpdateAdminPermissionsDto {
  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description: 'Permissions to ADD to existing set',
    example: ['MANAGE_PRODUCTS', 'VIEW_ORDERS'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  add?: AdminPermission[];

  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description: 'Permissions to REMOVE from existing set',
    example: ['MANAGE_PAYMENTS'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  remove?: AdminPermission[];

  @ApiPropertyOptional({
    enum: AdminPermission,
    isArray: true,
    description: 'REPLACE all permissions with this set (overrides add/remove)',
    example: ['VIEW_PRODUCTS', 'VIEW_ORDERS', 'VIEW_REPORTS'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  set?: AdminPermission[];
}
