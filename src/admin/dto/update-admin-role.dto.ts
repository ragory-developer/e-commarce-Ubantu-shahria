import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class UpdateAdminRoleDto {
  @ApiProperty({
    enum: AdminRole,
    description: 'New role. Cannot set SUPERADMIN.',
    example: AdminRole.MANAGER,
  })
  @IsEnum(AdminRole)
  role!: AdminRole;
}
