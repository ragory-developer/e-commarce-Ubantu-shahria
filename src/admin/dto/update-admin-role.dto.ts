// ─── src/admin/dto/update-admin-role.dto.ts ─────────────────
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class UpdateAdminRoleDto {
  @ApiProperty({
    enum: AdminRole,
    description: 'New role. Cannot promote to SUPERADMIN.',
    example: AdminRole.MANAGER,
  })
  @IsEnum(AdminRole)
  role!: AdminRole;
}
