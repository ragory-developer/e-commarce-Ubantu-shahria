// ─── src/admin/dto/manage-customer.dto.ts ───────────────────
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MaxLength,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CustomerTagColor } from '@prisma/client';

export class AdminUpdateCustomerDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Email address',
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({ example: true, description: 'Account active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminResetCustomerPasswordDto {
  @ApiProperty({
    example: 'TempP@ss123',
    description: 'New temporary password for the customer',
    minLength: 8,
  })
  @IsString()
  @MaxLength(72)
  newPassword!: string;
}

export class BulkCustomerActionDto {
  @ApiProperty({
    example: ['clx1', 'clx2'],
    description: 'Array of customer IDs to act on',
  })
  @IsArray()
  @IsString({ each: true })
  customerIds!: string[];

  @ApiProperty({
    example: 'activate',
    enum: ['activate', 'deactivate', 'delete'],
    description: 'Action to perform on selected customers',
  })
  @IsString()
  action!: 'activate' | 'deactivate' | 'delete';
}
