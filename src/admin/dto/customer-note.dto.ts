// ─── src/admin/dto/customer-note.dto.ts ─────────────────────
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerNoteDto {
  @ApiProperty({
    example: 'Customer called about refund issue on order #1234',
    description: 'Note content',
  })
  @IsString()
  @IsNotEmpty()
  note!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Pin this note to the top',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class UpdateCustomerNoteDto {
  @ApiPropertyOptional({ description: 'Updated note content' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;

  @ApiPropertyOptional({ description: 'Pin/unpin this note' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
