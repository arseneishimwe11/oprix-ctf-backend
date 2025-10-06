import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for querying competitions with filters
 */
export class CompetitionQueryDto {
  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    enum: ['DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    required: false,
    description: 'Filter by status',
  })
  @IsEnum(['DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
  @IsOptional()
  status?: 'DRAFT' | 'REGISTRATION_OPEN' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

  @ApiProperty({
    enum: ['JEOPARDY', 'ATTACK_DEFENSE', 'KING_OF_THE_HILL', 'MIXED'],
    required: false,
    description: 'Filter by type',
  })
  @IsEnum(['JEOPARDY', 'ATTACK_DEFENSE', 'KING_OF_THE_HILL', 'MIXED'])
  @IsOptional()
  type?: 'JEOPARDY' | 'ATTACK_DEFENSE' | 'KING_OF_THE_HILL' | 'MIXED';

  @ApiProperty({ required: false, description: 'Show only public competitions' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isPublic?: boolean;

  @ApiProperty({ required: false, description: 'Search by name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Show only competitions user registered for' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  myCompetitions?: boolean;
}