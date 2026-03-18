import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateShippingRuleDto } from './create-shipping-rule.dto';
export class UpdateShippingRuleDto extends PartialType(
  OmitType(CreateShippingRuleDto, ['deliveryZoneId', 'courierId'] as const),
) {}
