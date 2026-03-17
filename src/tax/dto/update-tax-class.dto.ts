import { PartialType } from '@nestjs/swagger';
import { CreateTaxClassDto } from './create-tax-class.dto';

export class UpdateTaxClassDto extends PartialType(CreateTaxClassDto) {}
