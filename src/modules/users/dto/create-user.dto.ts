import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsUrl,
  IsArray,
} from 'class-validator';

/**
 * DTO for creating a new user
 * Used only by SuperAdmin for manual user creation
 */
export class CreateUserDto {
  @ApiProperty({ example: 'user_2abc123xyz', description: 'Clerk user ID' })
  @IsString()
  clerkId: string;

  @ApiProperty({ example: 'johndoe', description: 'Username' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['USER', 'ADMIN', 'SUPERADMIN'], default: 'USER' })
  @IsEnum(['USER', 'ADMIN', 'SUPERADMIN'])
  @IsOptional()
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
}

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ example: 'Cybersecurity enthusiast', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ example: 'USA', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ example: 'https://example.com', required: false })
  @IsUrl()
  @IsOptional()
  website?: string;

  @ApiProperty({ example: 'johndoe', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  github?: string;

  @ApiProperty({ example: 'johndoe', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  linkedin?: string;

  @ApiProperty({ example: ['Web Security', 'Cryptography'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];
}