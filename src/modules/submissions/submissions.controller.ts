import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import {
  CreateSubmissionDto,
  SubmissionQueryDto,
  AdminSubmissionQueryDto,
} from './dto/create-submission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

/**
 * Submissions Controller
 * Core CTF flag submission engine with rate limiting
 */
@ApiTags('submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  /**
   * Submit a flag (Rate limited: 5/min, timeout after 3 fails)
   */
  @Post()
  @RateLimit({ limit: 5, ttl: 60 }) // 5 submissions per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit flag (Rate limited: 5/min, timeout after 3 fails)' })
  @ApiResponse({ status: 200, description: 'Flag submitted successfully' })
  @ApiResponse({ status: 400, description: 'Rate limit exceeded, timeout, or invalid submission' })
  @ApiResponse({ status: 403, description: 'Not registered for competition or challenge not visible' })
  @ApiResponse({ status: 409, description: 'Challenge already solved' })
  submit(
    @Body() createSubmissionDto: CreateSubmissionDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // SECURITY: Extract IP and user agent for audit trail
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    return this.submissionsService.submit(
      createSubmissionDto, 
      user.id,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get my submissions
   */
  @Get('my')
  @ApiOperation({ summary: 'Get my submissions (paginated)' })
  @ApiResponse({ status: 200, description: 'Submissions retrieved successfully' })
  findMy(
    @Query() query: SubmissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.findUserSubmissions(user.id, query);
  }

  /**
   * Get all submissions (Admin only)
   */
  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all submissions (Admin only)' })
  @ApiResponse({ status: 200, description: 'All submissions retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  findAllAdmin(
    @Query() query: AdminSubmissionQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.findAllAdmin(query, user.id);
  }

  /**
   * Get submission by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get submission details' })
  @ApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.findOne(id, user.id);
  }

  /**
   * Get submissions for a specific challenge (nested route)
   */
  @Get('challenge/:challengeId')
  @ApiOperation({ summary: 'Get my submissions for a specific challenge' })
  @ApiResponse({ status: 200, description: 'Challenge submissions retrieved successfully' })
  findByChallenge(
    @Param('challengeId') challengeId: string,
    @Query() query: Omit<SubmissionQueryDto, 'challengeId'>,
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.findUserSubmissions(user.id, {
      ...query,
      challengeId,
    });
  }

  /**
   * Get submissions for a specific competition (nested route)
   */
  @Get('competition/:competitionId')
  @ApiOperation({ summary: 'Get my submissions for a specific competition' })
  @ApiResponse({ status: 200, description: 'Competition submissions retrieved successfully' })
  findByCompetition(
    @Param('competitionId') competitionId: string,
    @Query() query: Omit<SubmissionQueryDto, 'competitionId'>,
    @CurrentUser() user: any,
  ) {
    return this.submissionsService.findUserSubmissions(user.id, {
      ...query,
      competitionId,
    });
  }
}
