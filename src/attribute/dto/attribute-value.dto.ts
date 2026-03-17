import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsObject,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { Transform } from 'class-transformer';

import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AttributeValueItemDto {
  @ApiProperty({
    example: 'Samsung',
    description: 'The attribute value',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  value!: string;

  @ApiPropertyOptional({
    type: Object,
    example: { bn: { value: 'স্যামসাং' } },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class AddAttributeValuesDto {
  @ApiProperty({
    type: [Object],
    description: 'Array of values to add',
    example: [{ value: 'Samsung' }, { value: 'Apple' }, { value: 'Motorola' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueItemDto)
  values!: AttributeValueItemDto[];
}

class UpdateAttributeValueItemDto extends AttributeValueItemDto {
  @ApiProperty({
    example: 'clx_av_123',
    description: 'Attribute value ID',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Position/order',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateAttributeValuesDto {
  @ApiProperty({
    type: [Object],
    description: 'Array of values to update',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAttributeValueItemDto)
  values!: UpdateAttributeValueItemDto[];
}
