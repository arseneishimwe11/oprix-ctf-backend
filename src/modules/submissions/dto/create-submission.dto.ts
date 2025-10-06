import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for submitting a flag
 * Rate limited: 5 submissions per minute
 */
export class CreateSubmissionDto {
  @ApiProperty({ example: 'challenge-uuid', description: 'Challenge ID' })
  @IsUUID()
  challengeId: string;

  @ApiProperty({ example: 'flag{th1s_1s_th3_fl4g}', description: 'Flag to submit' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  flag: string;

  @ApiProperty({ example: 'team-uuid', description: 'Team ID (for team competitions)', required: false })
  @IsUUID()
  @IsOptional()
  teamId?: string;
}

/**
 * DTO for querying submissions
 */
export class SubmissionQueryDto {
  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({ example: 'challenge-uuid', required: false, description: 'Filter by challenge' })
  @IsUUID()
  @IsOptional()
  challengeId?: string;

  @ApiProperty({ example: 'competition-uuid', required: false, description: 'Filter by competition' })
  @IsUUID()
  @IsOptional()
  competitionId?: string;

  @ApiProperty({ required: false, description: 'Show only correct submissions' })
  @IsOptional()
  @Type(() => Boolean)
  correctOnly?: boolean;

  @ApiProperty({ required: false, description: 'Show only incorrect submissions' })
  @IsOptional()
  @Type(() => Boolean)
  incorrectOnly?: boolean;
}

/**
 * DTO for admin submission queries
 */
export class AdminSubmissionQueryDto extends SubmissionQueryDto {
  @ApiProperty({ example: 'user-uuid', required: false, description: 'Filter by user' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: 'team-uuid', required: false, description: 'Filter by team' })
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @ApiProperty({ required: false, description: 'Include flag content in response (admin only)' })
  @IsOptional()
  @Type(() => Boolean)
  includeFlags?: boolean;
}