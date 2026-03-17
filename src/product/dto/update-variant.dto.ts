// ─── src/product/dto/update-variant.dto.ts ────────────────────

import { PartialType, OmitType } from '@nestjs/swagger';
import { ProductVariantItemDto } from './create-product.dto';

export class UpdateVariantDto extends PartialType(
  OmitType(ProductVariantItemDto, [] as const),
) {}
