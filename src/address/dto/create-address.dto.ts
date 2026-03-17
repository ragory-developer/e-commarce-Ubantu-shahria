import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiPropertyOptional({
    example: 'Home',
    description: 'Address label (e.g., Home, Office, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name for this address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  fullName!: string;

  @ApiProperty({
    example: '01712345678',
    description: 'Contact phone number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @ApiProperty({
    example: 'House 123, Road 5, Block B, Bashundhara R/A',
    description: 'Complete address line',
  })
  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @ApiProperty({
    example: 'clx1234567890',
    description: 'Division ID (get from /locations/divisions)',
  })
  @IsString()
  @IsNotEmpty()
  divisionId!: string;

  @ApiProperty({
    example: 'clx9876543210',
    description: 'City ID (get from /locations/divisions/:id/cities)',
  })
  @IsString()
  @IsNotEmpty()
  cityId!: string;

  @ApiProperty({
    example: 'clx5555555555',
    description: 'Area ID (get from /locations/cities/:id/areas)',
  })
  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @ApiProperty({
    example: '1229',
    description: 'Postal/ZIP code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @ApiPropertyOptional({
    example: 'BD',
    description: 'Country code (default: BD)',
    default: 'BD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Set as default address',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
