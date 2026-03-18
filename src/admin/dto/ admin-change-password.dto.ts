// ─── src/admin/dto/admin-change-password.dto.ts ─────────────
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminChangePasswordDto {
  @ApiProperty({ example: 'OldP@ss123', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    example: 'NewP@ss123',
    description: 'New password (min 8 chars)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class AdminResetPasswordDto {
  @ApiProperty({
    example: 'TempP@ss123',
    description: 'New password to set for the admin (min 8 chars)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
