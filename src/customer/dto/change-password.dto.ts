// ─── src/customer/dto/change-password.dto.ts ────────────────
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ss123', description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    example: 'NewP@ss123',
    description: 'New password (min 8 chars). All sessions will be revoked.',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
