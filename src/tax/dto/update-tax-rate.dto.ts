import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTaxRateDto } from './create-tax-rate.dto';

export class UpdateTaxRateDto extends PartialType(
  OmitType(CreateTaxRateDto, ['taxClassId'] as const),
) {}
