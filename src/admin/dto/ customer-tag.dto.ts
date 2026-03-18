// ─── src/admin/dto/customer-tag.dto.ts ──────────────────────
import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerTagColor } from '@prisma/client';

export class CreateCustomerTagDto {
  @ApiProperty({
    example: 'VIP',
    description: 'Tag label (max 50 chars)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label!: string;

  @ApiProperty({
    enum: CustomerTagColor,
    example: CustomerTagColor.GREEN,
    description: 'Tag color: RED, AMBER, GREEN, BLUE, GRAY',
  })
  @IsEnum(CustomerTagColor)
  color!: CustomerTagColor;
}

export class DeleteCustomerTagDto {
  @ApiProperty({
    example: 'VIP',
    description: 'Label of the tag to remove',
  })
  @IsString()
  @IsNotEmpty()
  label!: string;
}
