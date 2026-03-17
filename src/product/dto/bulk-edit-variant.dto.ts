// ─── src/product/dto/bulk-edit-variant.dto.ts ─────────────────

import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkEditVariantDto {
  @ApiProperty({
    example: 'price',
    enum: [
      'price',
      'specialPrice',
      'specialPriceType',
      'manageStock',
      'inStock',
      'qty',
    ],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'price',
    'specialPrice',
    'specialPriceType',
    'manageStock',
    'inStock',
    'qty',
  ])
  field!: string;

  @ApiProperty({
    example: 30,
    description: 'New value for the field (type matches the field)',
  })
  @IsNotEmpty()
  value!: unknown;
}
