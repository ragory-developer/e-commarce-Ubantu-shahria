// ─── src/product/dto/product-review.dto.ts ────────────────────

import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ example: 5, description: 'Rating 1-5' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Amazing quality!' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiProperty({
    example: 'Really comfortable and fits perfectly. Will buy again!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment!: string;

  @ApiProperty({ example: 'John D.', description: 'Public display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => value?.trim())
  reviewerName!: string;
}

export class AdminReviewReplyDto {
  @ApiProperty({ example: 'Thank you for your feedback!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reply!: string;
}

export class ListReviewsDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take: number = 10;

  @ApiPropertyOptional({ example: 5, description: 'Filter by rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    example: 'newest',
    enum: ['newest', 'oldest', 'highest_rating', 'lowest_rating'],
  })
  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest_rating', 'lowest_rating'])
  sortBy?: string = 'newest';

  @ApiPropertyOptional({
    example: true,
    description: 'Admin: filter by approval status',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isApproved?: boolean;
}
