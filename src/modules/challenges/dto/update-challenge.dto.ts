import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateChallengeDto } from './create-challenge.dto';
import { IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for updating a challenge
 * All fields from CreateChallengeDto are optional
 */
export class UpdateChallengeDto extends PartialType(CreateChallengeDto) {}

/**
 * DTO for updating challenge visibility
 */
export class UpdateChallengeVisibilityDto {
  @ApiProperty({ example: true, description: 'Is challenge visible to participants?' })
  isVisible: boolean;
}

/**
 * DTO for creating/updating hints
 */
export class CreateHintDto {
  @ApiProperty({ example: 'Look at the HTTP headers', description: 'Hint content' })
  @IsString()
  content: string;

  @ApiProperty({ example: 10, description: 'Points cost to unlock hint' })
  @IsNumber()
  @Min(0)
  @Max(100)
  cost: number;

  @ApiProperty({ example: 1, description: 'Hint order/sequence' })
  @IsNumber()
  @Min(1)
  order: number;
}

/**
 * DTO for unlocking a hint
 */
export class UnlockHintDto {
  @ApiProperty({ example: 'hint-uuid', description: 'Hint ID to unlock' })
  @IsString()
  hintId: string;
}

/**
 * DTO for challenge query/filter
 */
export class ChallengeQueryDto {
  @ApiProperty({ required: false, description: 'Filter by category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    enum: ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'],
    required: false,
    description: 'Filter by difficulty',
  })
  @IsEnum(['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'])
  @IsOptional()
  difficulty?: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

  @ApiProperty({ required: false, description: 'Show solved challenges only' })
  @IsOptional()
  solved?: boolean;

  @ApiProperty({ required: false, description: 'Show unsolved challenges only' })
  @IsOptional()
  unsolved?: boolean;

  @ApiProperty({ required: false, description: 'Search in title and description' })
  @IsString()
  @IsOptional()
  search?: string;
}