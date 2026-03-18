// src/customer/dto/customer-address-query.dto.ts
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CustomerAddressQueryDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Filter to return only the default address',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  defaultOnly?: boolean;
}
