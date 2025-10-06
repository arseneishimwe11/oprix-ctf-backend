import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO for file upload
 */
export class CreateFileDto {
  @ApiProperty({ example: 'challenge-uuid', description: 'Challenge ID to attach file to' })
  @IsUUID()
  challengeId: string;

  @ApiProperty({ 
    example: 'Binary file for reverse engineering challenge', 
    description: 'File description',
    required: false 
  })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * DTO for file query parameters
 */
export class FileQueryDto {
  @ApiProperty({ required: false, description: 'Filter by challenge ID' })
  @IsUUID()
  @IsOptional()
  challengeId?: string;

  @ApiProperty({ required: false, description: 'Filter by file type' })
  @IsString()
  @IsOptional()
  fileType?: string;

  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  @IsOptional()
  limit?: number;
}
