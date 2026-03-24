import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ReturnReason } from '@prisma/client';

export class ReturnItemDto {
  @ApiProperty({
    example: 'clx_orderproduct_001',
    description: 'OrderProduct ID',
  })
  @IsString()
  @IsNotEmpty()
  orderProductId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class CustomerCreateReturnDto {
  @ApiProperty({ example: 'clx_order_001' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @ApiProperty({ enum: ReturnReason })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiPropertyOptional({ example: 'Product arrived cracked' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonDetail?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Evidence photo media IDs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceImages?: string[];
}
