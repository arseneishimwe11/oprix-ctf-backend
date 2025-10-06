import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsBoolean,
  IsJSON,
  IsUrl,
} from 'class-validator';

/**
 * DTO for creating a new challenge
 */
export class CreateChallengeDto {
  @ApiProperty({ example: 'SQL Injection Basics', description: 'Challenge title' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: 'Find the flag by exploiting SQL injection vulnerability',
    description: 'Challenge description',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ example: 'WEB', description: 'Challenge category' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category: string;

  @ApiProperty({
    enum: ['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'INSANE'],
    example: 'MEDIUM',
    description: 'Challenge difficulty',
  })
  @IsEnum(['TRIVIAL', 'EASY', 'MEDIUM', 'HARD', 'INSANE'])
  difficulty: 'TRIVIAL' | 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE';

  @ApiProperty({ example: 100, description: 'Points awarded for solving' })
  @IsNumber()
  @Min(1)
  @Max(1000)
  points: number;

  @ApiProperty({ example: 'flag{sql_1nj3ct10n_m4st3r}', description: 'The flag to submit' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  flag: string;

  @ApiProperty({ 
    example: false, 
    description: 'Whether flag comparison should be case sensitive', 
    required: false 
  })
  @IsBoolean()
  @IsOptional()
  caseSensitive?: boolean;

  @ApiProperty({ 
    example: true, 
    description: 'Whether to normalize whitespace in flag comparison', 
    required: false 
  })
  @IsBoolean()
  @IsOptional()
  normalizeFlag?: boolean;

  @ApiProperty({ example: true, description: 'Is challenge visible to participants?', required: false })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @ApiProperty({ example: false, description: 'Is challenge dynamic (instances per user)?', required: false })
  @IsBoolean()
  @IsOptional()
  isDynamic?: boolean;

  @ApiProperty({ example: 'http://challenge.ctf.com:8080', description: 'Challenge URL/endpoint', required: false })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({
    example: { author: 'John Doe', source: 'DefCon 2023', docker_image: 'myctf/sqli:latest' },
    description: 'Additional challenge metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    example: ['Look for common SQL injection patterns', 'Try UNION SELECT statements'],
    description: 'Hints for the challenge',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hints?: string[];
}

/**
 * DTO for uploading challenge files
 */
export class UploadChallengeFileDto {
  @ApiProperty({ example: 'Challenge source code', description: 'File description' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: true, description: 'Is file required to solve challenge?', required: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}