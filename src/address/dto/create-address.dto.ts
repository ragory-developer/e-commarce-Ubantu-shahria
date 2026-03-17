import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiProperty({ example: '123 Main St, Apt 4B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  address!: string;

  @ApiProperty({ example: 'Apartment notes or landmark' })
  @IsString()
  @IsNotEmpty()
  descriptions!: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  city!: string;

  @ApiProperty({ example: 'Dhaka Division' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  state!: string;

  @ApiProperty({ example: 'Road 5, Block B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  road!: string;

  @ApiProperty({ example: '1207' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zip!: string;

  @ApiProperty({ example: 'BD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  country!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
