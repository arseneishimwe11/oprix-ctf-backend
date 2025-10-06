import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SuperadminService } from './superadmin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('superadmin')
@ApiBearerAuth()
@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Post('admins')
  @ApiOperation({ summary: 'Create new Admin account (SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Admin account created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - SuperAdmin role required' })
  async createAdmin(
    @Body() createAdminDto: {
      username: string;
      email: string;
      password: string;
      organizationName?: string;
    },
    @Request() req,
  ) {
    return this.superadminService.createAdmin(createAdminDto, req.user.userId);
  }

  @Get('admins')
  @ApiOperation({ summary: 'Get all Admin accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of all admins' })
  async getAllAdmins(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.superadminService.getAllAdmins(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('admins/:id')
  @ApiOperation({ summary: 'Get admin activity report' })
  @ApiResponse({ status: 200, description: 'Admin activity details' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async getAdminActivity(@Param('id') adminId: string) {
    return this.superadminService.getAdminActivity(adminId);
  }

  @Patch('admins/:id/toggle-status')
  @ApiOperation({ summary: 'Suspend or activate Admin account' })
  @ApiResponse({ status: 200, description: 'Admin status toggled' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async toggleAdminStatus(@Param('id') adminId: string, @Request() req) {
    return this.superadminService.toggleAdminStatus(adminId, req.user.userId);
  }

  @Delete('admins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete Admin account' })
  @ApiResponse({ status: 200, description: 'Admin deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete admin with active competitions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async deleteAdmin(@Param('id') adminId: string, @Request() req) {
    return this.superadminService.deleteAdmin(adminId, req.user.userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide statistics' })
  @ApiResponse({ status: 200, description: 'Platform statistics' })
  async getPlatformStats() {
    return this.superadminService.getPlatformStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system audit logs' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.superadminService.getAuditLogs({
      userId,
      action,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get SuperAdmin profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved' })
  async getMyProfile(@Request() req) {
    return this.superadminService.getMyProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update SuperAdmin profile (for production handover)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 403, description: 'Current password is incorrect' })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  async updateMyProfile(
    @Body() updateProfileDto: {
      currentPassword: string;
      newPassword?: string;
      email?: string;
      username?: string;
    },
    @Request() req,
  ) {
    return this.superadminService.updateMyProfile(req.user.userId, updateProfileDto);
  }

}
