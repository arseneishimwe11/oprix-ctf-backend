import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Challenges Module
 * Handles CTF challenges with nested routes under competitions
 * Routes: /competitions/:competitionId/challenges/*
 */
@Module({
  imports: [AuthModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
