import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for creating a new team
 */
export class CreateTeamDto {
  @ApiProperty({ example: 'Cyber Ninjas', description: 'Team name' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'Elite cybersecurity team specializing in web exploitation',
    description: 'Team description',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 4, description: 'Maximum team size', required: false, default: 4 })
  @IsNumber()
  @Min(2)
  @Max(10)
  @IsOptional()
  maxSize?: number;

  @ApiProperty({ example: 'comp-uuid-123', description: 'Competition ID that the team will participate in' })
  @IsString()
  competitionId: string;
}

/**
 * DTO for joining a team
 */
export class JoinTeamDto {
  @ApiProperty({ example: 'ABC123XYZ', description: 'Team invitation code' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  inviteCode: string;
}

/**
 * DTO for inviting team member
 */
export class InviteTeamMemberDto {
  @ApiProperty({ example: 'user-uuid', description: 'User ID to invite' })
  @IsString()
  userId: string;
}

/**
 * DTO for kicking team member
 */
export class KickTeamMemberDto {
  @ApiProperty({ example: 'user-uuid', description: 'User ID to kick from team' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'Inactive member', description: 'Reason for kicking', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}

/**
 * DTO for transferring team captaincy
 */
export class TransferCaptaincyDto {
  @ApiProperty({ example: 'user-uuid', description: 'New captain user ID' })
  @IsString()
  newCaptainId: string;
}
