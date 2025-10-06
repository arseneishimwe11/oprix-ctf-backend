import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Files Module
 * Handles file uploads, storage, and management for CTF challenges
 */
@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
