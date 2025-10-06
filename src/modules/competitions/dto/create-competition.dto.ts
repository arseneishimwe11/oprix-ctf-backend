import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';

/**
 * DTO for creating a new competition
 */
export class CreateCompetitionDto {
  @ApiProperty({ example: 'Summer CTF 2025', description: 'Competition name' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'An exciting CTF competition for summer',
    description: 'Competition description',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ example: '2025-07-01T00:00:00Z', description: 'Start date and time' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2025-07-03T23:59:59Z', description: 'End date and time' })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    enum: ['JEOPARDY', 'ATTACK_DEFENSE', 'KING_OF_THE_HILL', 'MIXED'],
    example: 'JEOPARDY',
    description: 'Competition type',
  })
  @IsEnum(['JEOPARDY', 'ATTACK_DEFENSE', 'KING_OF_THE_HILL', 'MIXED'])
  type: 'JEOPARDY' | 'ATTACK_DEFENSE' | 'KING_OF_THE_HILL' | 'MIXED';

  @ApiProperty({ example: false, description: 'Is this a team-based competition?', required: false })
  @IsBoolean()
  @IsOptional()
  isTeamBased?: boolean;

  @ApiProperty({ example: 4, description: 'Maximum team size', required: false })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxTeamSize?: number;

  @ApiProperty({ example: 100, description: 'Maximum participants', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;

  @ApiProperty({ example: false, description: 'Require approval to register?', required: false })
  @IsBoolean()
  @IsOptional()
  requireApproval?: boolean;

  @ApiProperty({ example: true, description: 'Is competition visible?', required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({
    example: ['WEB', 'CRYPTO', 'PWN'],
    description: 'Challenge categories',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedCategories?: string[];

  @ApiProperty({
    example: { difficulty: 'beginner', prizes: 'Top 3 winners get prizes' },
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}