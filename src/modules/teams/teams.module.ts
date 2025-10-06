import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Teams Module
 * Handles team creation, invitations, and team management for CTF competitions
 */
@Module({
  imports: [AuthModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
