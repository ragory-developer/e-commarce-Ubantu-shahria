// src/product/dto/product-question.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateQuestionDto {
  @ApiProperty({ example: 'Does this shirt shrink after washing?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question!: string;

  @ApiProperty({ example: 'John D.', description: 'Public display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  askerName!: string;
}

export class CreateAnswerDto {
  @ApiProperty({
    example: 'No, it is preshrunk and will maintain its size after washing.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  answer!: string;

  @ApiProperty({
    example: 'Support Team',
    description: 'Name shown to customers',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  answererName!: string;
}

export class ListQuestionsDto {
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
}
