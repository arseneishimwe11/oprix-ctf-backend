import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';

/**
 * Leaderboard Controller
 * Handles real-time CTF rankings and scoring
 */
@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Get competition leaderboard (individual)
   */
  @Get('competition/:competitionId')
  @ApiOperation({ summary: 'Get competition leaderboard (individual rankings)' })
  @ApiResponse({ status: 200, description: 'Competition leaderboard retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Competition not found' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of entries to return', example: 50 })
  getCompetitionLeaderboard(
    @Param('competitionId') competitionId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.leaderboardService.getCompetitionLeaderboard(competitionId, limit);
  }

  /**
   * Get team leaderboard for competition
   */
  @Get('competition/:competitionId/team')
  @ApiOperation({ summary: 'Get team leaderboard for competition' })
  @ApiResponse({ status: 200, description: 'Team leaderboard retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Competition is not in team mode' })
  @ApiResponse({ status: 404, description: 'Competition not found' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of teams to return', example: 50 })
  getTeamLeaderboard(
    @Param('competitionId') competitionId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.leaderboardService.getTeamLeaderboard(competitionId, limit);
  }

  /**
   * Get global leaderboard (all-time)
   */
  @Get('global')
  @ApiOperation({ summary: 'Get global leaderboard (all-time across all competitions)' })
  @ApiResponse({ status: 200, description: 'Global leaderboard retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of entries to return', example: 100 })
  getGlobalLeaderboard(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return this.leaderboardService.getGlobalLeaderboard(limit);
  }

  /**
   * Get user rank in competition
   */
  @Get('user/:userId/competition/:competitionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user rank and position in competition' })
  @ApiResponse({ status: 200, description: 'User rank retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User or competition not found' })
  getUserRank(
    @Param('competitionId') competitionId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    // Users can only see their own rank unless they're admin
    if (currentUser.id !== userId && currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERADMIN') {
      userId = currentUser.id; // Force to current user
    }
    return this.leaderboardService.getUserRank(competitionId, userId);
  }

  /**
   * Get my rank in competition
   */
  @Get('my/competition/:competitionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get my rank and position in competition' })
  @ApiResponse({ status: 200, description: 'User rank retrieved successfully' })
  getMyRank(
    @Param('competitionId') competitionId: string,
    @CurrentUser() user: any,
  ) {
    return this.leaderboardService.getUserRank(competitionId, user.id);
  }

  /**
   * Get team rank in competition
   */
  @Get('team/:teamId/competition/:competitionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get team rank and position in competition' })
  @ApiResponse({ status: 200, description: 'Team rank retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team or competition not found' })
  getTeamRank(
    @Param('competitionId') competitionId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.leaderboardService.getTeamRank(competitionId, teamId);
  }

  /**
   * Get live leaderboard updates (for real-time updates)
   */
  @Get('live/:competitionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get live leaderboard updates (for WebSocket/real-time)' })
  @ApiResponse({ status: 200, description: 'Live leaderboard data retrieved successfully' })
  getLiveLeaderboard(
    @Param('competitionId') competitionId: string,
  ) {
    return this.leaderboardService.getLiveLeaderboardUpdate(competitionId);
  }
}
