import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateTeamDto } from './create-team.dto';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating team details
 */
export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

/**
 * DTO for team query/filtering
 */
export class TeamQueryDto {
  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({ required: false, description: 'Search team names' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by competition ID' })
  @IsString()
  @IsOptional()
  competitionId?: string;

  @ApiProperty({ required: false, description: 'Show only teams with available slots' })
  @IsOptional()
  @Type(() => Boolean)
  availableOnly?: boolean;
}

/**
 * DTO for team statistics
 */
export class TeamStatsDto {
  @ApiProperty({ example: 1250, description: 'Total points earned' })
  totalPoints: number;

  @ApiProperty({ example: 15, description: 'Challenges solved' })
  challengesSolved: number;

  @ApiProperty({ example: 3, description: 'Competitions participated' })
  competitionsParticipated: number;

  @ApiProperty({ example: 2, description: 'Competition wins' })
  competitionWins: number;

  @ApiProperty({ example: 4, description: 'Current team size' })
  currentSize: number;

  @ApiProperty({ example: 4, description: 'Maximum team size' })
  maxSize: number;
}
