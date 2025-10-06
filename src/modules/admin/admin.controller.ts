import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard overview' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
  async getDashboard(@Request() req) {
    return this.adminService.getMyDashboard(req.user.userId);
  }

  @Get('players')
  @ApiOperation({ summary: 'Get players registered in admin\'s competitions' })
  @ApiQuery({ name: 'competitionId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of players' })
  async getMyPlayers(
    @Request() req,
    @Query('competitionId') competitionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getMyPlayers(req.user.userId, {
      competitionId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Patch('players/:userId/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban or unban player from competition' })
  @ApiQuery({ name: 'competitionId', required: true })
  @ApiResponse({ status: 200, description: 'Player ban status toggled' })
  @ApiResponse({ status: 404, description: 'Player or competition not found' })
  async togglePlayerBan(
    @Param('userId') userId: string,
    @Query('competitionId') competitionId: string,
    @Request() req,
  ) {
    return this.adminService.togglePlayerBan(userId, competitionId, req.user.userId);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get submissions for admin\'s competitions' })
  @ApiQuery({ name: 'competitionId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of submissions' })
  async getMySubmissions(
    @Request() req,
    @Query('competitionId') competitionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getMySubmissions(
      req.user.userId,
      competitionId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('competitions/:id/stats')
  @ApiOperation({ summary: 'Get statistics for admin\'s competition' })
  @ApiResponse({ status: 200, description: 'Competition statistics' })
  @ApiResponse({ status: 404, description: 'Competition not found or access denied' })
  async getCompetitionStats(
    @Param('id') competitionId: string,
    @Request() req,
  ) {
    return this.adminService.getMyCompetitionStats(competitionId, req.user.userId);
  }
}
