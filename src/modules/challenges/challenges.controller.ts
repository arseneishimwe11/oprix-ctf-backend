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
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import {
  UpdateChallengeDto,
  CreateHintDto,
  ChallengeQueryDto,
} from './dto/update-challenge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';

/**
 * Challenges Controller
 * Handles challenge management with nested routes under competitions
 * Routes: /competitions/:competitionId/challenges/*
 */
@ApiTags('challenges')
@Controller('competitions/:competitionId/challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  /**
   * Create a new challenge (Admin/Competition Owner only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new challenge (Admin/Owner only)' })
  @ApiResponse({ status: 201, description: 'Challenge created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or competition is active' })
  @ApiResponse({ status: 403, description: 'Only competition owner or admins can create challenges' })
  create(
    @Param('competitionId') competitionId: string,
    @Body() createChallengeDto: CreateChallengeDto,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.create(competitionId, createChallengeDto, user.id);
  }

  /**
   * Get all challenges in a competition
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get challenges in competition (registered users only)' })
  @ApiResponse({ status: 200, description: 'Challenges retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Must be registered for this competition' })
  findAll(
    @Param('competitionId') competitionId: string,
    @Query() query: ChallengeQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.findAll(competitionId, query, user.id);
  }

  /**
   * Get a specific challenge by ID
   */
  @Get(':challengeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get challenge details' })
  @ApiResponse({ status: 200, description: 'Challenge retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Challenge not found' })
  @ApiResponse({ status: 403, description: 'Challenge not visible or not registered' })
  findOne(
    @Param('competitionId') competitionId: string,
    @Param('challengeId') challengeId: string,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.findOne(competitionId, challengeId, user.id);
  }

  /**
   * Update challenge details (Admin/Owner only)
   */
  @Put(':challengeId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update challenge (Admin/Owner only)' })
  @ApiResponse({ status: 200, description: 'Challenge updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot edit challenges in active competition' })
  @ApiResponse({ status: 403, description: 'Only competition owner or admins can update challenges' })
  update(
    @Param('competitionId') competitionId: string,
    @Param('challengeId') challengeId: string,
    @Body() updateChallengeDto: UpdateChallengeDto,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.update(competitionId, challengeId, updateChallengeDto, user.id);
  }

  /**
   * Delete challenge (Admin/Owner only)
   */
  @Delete(':challengeId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete challenge (Admin/Owner only)' })
  @ApiResponse({ status: 200, description: 'Challenge deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete challenges from active competition' })
  @ApiResponse({ status: 403, description: 'Only competition owner or admins can delete challenges' })
  remove(
    @Param('competitionId') competitionId: string,
    @Param('challengeId') challengeId: string,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.remove(competitionId, challengeId, user.id);
  }

  /**
   * Create hint for challenge (Admin/Owner only)
   */
  @Post(':challengeId/hints')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create hint for challenge (Admin/Owner only)' })
  @ApiResponse({ status: 201, description: 'Hint created successfully' })
  @ApiResponse({ status: 403, description: 'Only competition owner or admins can create hints' })
  createHint(
    @Param('competitionId') competitionId: string,
    @Param('challengeId') challengeId: string,
    @Body() createHintDto: CreateHintDto,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.createHint(competitionId, challengeId, createHintDto, user.id);
  }

  /**
   * Unlock hint (costs points)
   */
  @Post(':challengeId/hints/:hintId/unlock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock hint (costs points)' })
  @ApiResponse({ status: 200, description: 'Hint unlocked successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient points or hint already unlocked' })
  @ApiResponse({ status: 403, description: 'Must be registered for this competition' })
  unlockHint(
    @Param('competitionId') competitionId: string,
    @Param('challengeId') challengeId: string,
    @Param('hintId') hintId: string,
    @CurrentUser() user: any,
  ) {
    return this.challengesService.unlockHint(competitionId, challengeId, hintId, user.id);
  }
}
