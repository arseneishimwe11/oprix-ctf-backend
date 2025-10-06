import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import {
  CreateTeamDto,
  JoinTeamDto,
  InviteTeamMemberDto,
  KickTeamMemberDto,
  TransferCaptaincyDto,
} from './dto/create-team.dto';
import { UpdateTeamDto, TeamQueryDto } from './dto/update-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';

/**
 * Teams Controller
 * Handles team creation, management, and membership for CTF competitions
 */
@ApiTags('teams')
@Controller('teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * Create a new team (becomes captain)
   */
  @Post()
  @ApiOperation({ summary: 'Create team (generates invite code)' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 409, description: 'User already in a team' })
  create(
    @Body() createTeamDto: CreateTeamDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.create(createTeamDto, user.id);
  }

  /**
   * Get all teams (public with optional filtering)
   */
  @Get()
  @ApiOperation({ summary: 'List all teams (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully' })
  findAll(@Query() query: TeamQueryDto) {
    return this.teamsService.findAll(query);
  }

  /**
   * Join team with invite code
   */
  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join team with invite code' })
  @ApiResponse({ status: 200, description: 'Successfully joined team' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'Already in a team or team is full' })
  @ApiResponse({ status: 400, description: 'Cannot join during active competition' })
  joinTeam(
    @Body() joinTeamDto: JoinTeamDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.joinTeam(joinTeamDto, user.id);
  }

  /**
   * Get team details by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get team details' })
  @ApiResponse({ status: 200, description: 'Team details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.findOne(id, user.id);
  }

  /**
   * Update team details (Captain only)
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update team (captain only)' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 403, description: 'Only team captain can update' })
  @ApiResponse({ status: 400, description: 'Cannot edit during active competition' })
  update(
    @Param('id') id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.update(id, updateTeamDto, user.id);
  }

  /**
   * Delete team (Captain only, before competitions start)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete team (captain only, before competition starts)' })
  @ApiResponse({ status: 200, description: 'Team deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only team captain can delete' })
  @ApiResponse({ status: 400, description: 'Cannot delete team with active competitions' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.remove(id, user.id);
  }

  /**
   * Leave team (Members only, not during active competition)
   */
  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave team (not during active competition)' })
  @ApiResponse({ status: 200, description: 'Successfully left team' })
  @ApiResponse({ status: 400, description: 'Captain cannot leave or active competition' })
  leaveTeam(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.leaveTeam(id, user.id);
  }

  /**
   * Kick team member (Captain only, not during active competition)
   */
  @Post(':id/kick')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kick member (captain only, not during active competition)' })
  @ApiResponse({ status: 200, description: 'Member kicked successfully' })
  @ApiResponse({ status: 403, description: 'Only team captain can kick members' })
  @ApiResponse({ status: 400, description: 'Cannot kick during active competition' })
  kickMember(
    @Param('id') id: string,
    @Body() kickTeamMemberDto: KickTeamMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.kickMember(id, kickTeamMemberDto, user.id);
  }

  /**
   * Transfer team captaincy (Captain only)
   */
  @Post(':id/transfer-captaincy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer captaincy to another member (captain only)' })
  @ApiResponse({ status: 200, description: 'Captaincy transferred successfully' })
  @ApiResponse({ status: 403, description: 'Only current captain can transfer' })
  @ApiResponse({ status: 400, description: 'New captain must be a team member' })
  transferCaptaincy(
    @Param('id') id: string,
    @Body() transferCaptaincyDto: TransferCaptaincyDto,
    @CurrentUser() user: any,
  ) {
    return this.teamsService.transferCaptaincy(id, transferCaptaincyDto, user.id);
  }

  /**
   * Get team statistics
   */
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get team statistics' })
  @ApiResponse({ status: 200, description: 'Team statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  getStats(@Param('id') id: string) {
    return this.teamsService.getTeamStats(id);
  }
}
