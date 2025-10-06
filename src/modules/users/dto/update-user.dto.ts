import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

/**
 * DTO for updating user details (admin only)
 */
export class UpdateUserDto {
  @ApiProperty({ example: 'johndoe2', required: false })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @ApiProperty({ enum: ['USER', 'ADMIN', 'SUPERADMIN'], required: false })
  @IsEnum(['USER', 'ADMIN', 'SUPERADMIN'])
  @IsOptional()
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * DTO for updating user role (SuperAdmin only)
 */
export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['USER', 'ADMIN', 'SUPERADMIN'] })
  @IsEnum(['USER', 'ADMIN', 'SUPERADMIN'])
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
}

/**
 * DTO for query parameters when listing users
 */
export class ListUsersQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  limit?: number;

  @ApiProperty({ enum: ['USER', 'ADMIN', 'SUPERADMIN'], required: false })
  @IsEnum(['USER', 'ADMIN', 'SUPERADMIN'])
  @IsOptional()
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}