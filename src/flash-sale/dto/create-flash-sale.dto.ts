import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
  IsDateString,
  IsNumber,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class FlashSaleProductItemDto {
  @ApiProperty({
    example: 'clx_product_123',
    description: 'Product ID to include in flash sale',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    example: 99.99,
    description: 'Flash sale price for this product',
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({
    example: 100,
    description: 'Quantity available for flash sale',
  })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({
    example: '2026-03-15T23:59:59Z',
    description: 'End date for this product in flash sale',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display position',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateFlashSaleDto {
  @ApiProperty({
    example: 'Spring Sale 2026',
    description: 'Name of the flash sale campaign',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  campaignName!: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Translations for campaign name',
    example: {
      bn: { campaignName: 'বসন্ত বিক্রয় ২০২৬' },
      ar: { campaignName: 'تخفيضات الربيع ٢٠٢٦' },
    },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;

  @ApiProperty({
    type: [FlashSaleProductItemDto],
    description: 'Products to include in flash sale',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlashSaleProductItemDto)
  products!: FlashSaleProductItemDto[];
}
