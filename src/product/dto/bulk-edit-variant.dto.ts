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
    description: 'Field to update across all variants',
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
    description:
      'New value — type must match field (number for price/qty, boolean for stock flags)',
  })
  @IsNotEmpty()
  value!: unknown;
}
