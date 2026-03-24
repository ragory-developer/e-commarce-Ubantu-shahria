import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsNumber,
  // IsBoolean,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

// ─── Cart Item ─────────────────────────────────────────────────
export class CartItemDto {
  @ApiProperty({ example: 'clx_product_001' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({ example: 'clx_variant_001' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  qty!: number;
}

// ─── Guest Info ────────────────────────────────────────────────
export class GuestInfoDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  fullName!: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}

// ─── Guest Address ─────────────────────────────────────────────
export class GuestAddressDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  fullName!: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone!: string;

  @ApiProperty({ example: 'House 5, Road 3, Gulshan' })
  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @ApiProperty({ example: 'clx_div_001' })
  @IsString()
  @IsNotEmpty()
  divisionId!: string;

  @ApiProperty({ example: 'clx_city_001' })
  @IsString()
  @IsNotEmpty()
  cityId!: string;

  @ApiProperty({ example: 'clx_area_001' })
  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @ApiProperty({ example: '1212' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @ApiPropertyOptional({ example: 'BD', default: 'BD' })
  @IsOptional()
  @IsString()
  country?: string;
}

// ─── Initiate Checkout ─────────────────────────────────────────
export class InitiateCheckoutDto {
  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];

  @ApiPropertyOptional({
    description: 'Guest session ID from frontend (localStorage UUID)',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    type: GuestInfoDto,
    description: 'Required for guest checkout',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo?: GuestInfoDto;
}

// ─── Update Items ──────────────────────────────────────────────
export class UpdateItemsDto {
  @ApiProperty({ type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];
}

// ─── Set Address ───────────────────────────────────────────────
export class SetAddressDto {
  @ApiPropertyOptional({
    description: 'Saved address ID (authenticated customers)',
  })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({
    type: GuestAddressDto,
    description: 'Inline address (guest / override)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuestAddressDto)
  address?: GuestAddressDto;

  @ApiPropertyOptional({ example: 'clx_courier_001' })
  @IsOptional()
  @IsString()
  courierId?: string;
}

// ─── Apply Coupon ──────────────────────────────────────────────
export class ApplyCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toUpperCase().trim())
  code!: string;
}

// ─── Set Wallet ────────────────────────────────────────────────
export class SetWalletAmountDto {
  @ApiProperty({
    example: 100,
    description: 'Amount to use from wallet (0 to disable)',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

// ─── Select Payment ────────────────────────────────────────────
export class SelectPaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

// ─── Place Order ───────────────────────────────────────────────
export class PlaceOrderDto {
  @ApiPropertyOptional({ example: 'Please leave at the gate' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
