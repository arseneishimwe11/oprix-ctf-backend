import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCompetitionDto } from './create-competition.dto';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * DTO for updating a competition
 * All fields from CreateCompetitionDto are optional
 */
export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}

/**
 * DTO for updating competition status
 */
export class UpdateCompetitionStatusDto {
  @ApiProperty({
    enum: ['DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
    example: 'ACTIVE',
  })
  @IsEnum(['DRAFT', 'REGISTRATION_OPEN', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
  status: 'DRAFT' | 'REGISTRATION_OPEN' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

/**
 * DTO for registering for a competition
 */
export class RegisterCompetitionDto {
  @ApiProperty({ example: 'team-uuid', description: 'Team ID (if team-based)', required: false })
  @IsOptional()
  teamId?: string;
}