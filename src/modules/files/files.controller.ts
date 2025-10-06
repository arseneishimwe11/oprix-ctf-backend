import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import * as express from 'express';
import { FilesService } from './files.service';
import { CreateFileDto, FileQueryDto } from './dto/create-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/auth.decorator';
import { createReadStream } from 'fs';

/**
 * Files Controller
 * Handles file uploads, downloads, and management for CTF challenges
 */
@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Upload file for challenge (Admin only)
   */
  @Post('upload')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file for challenge (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        challengeId: {
          type: 'string',
          description: 'Challenge ID to attach file to',
        },
        description: {
          type: 'string',
          description: 'File description',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 403, description: 'Only competition admin can upload files' })
  uploadFile(
    @UploadedFile() file: any,
    @Body() createFileDto: CreateFileDto,
    @CurrentUser() user: any,
  ) {
    return this.filesService.uploadFile(file, createFileDto, user.id);
  }

  /**
   * Get all files (with access control)
   */
  @Get()
  @ApiOperation({ summary: 'Get all accessible files (paginated)' })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  findAll(
    @Query() query: FileQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.filesService.findAll(query, user.id);
  }

  /**
   * Get files for specific challenge
   */
  @Get('challenge/:challengeId')
  @ApiOperation({ summary: 'Get files for specific challenge' })
  @ApiResponse({ status: 200, description: 'Challenge files retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Challenge not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getChallengeFiles(
    @Param('challengeId') challengeId: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.getChallengFiles(challengeId, user.id);
  }

  /**
   * Download file by filename
   */
  @Get('download/:fileName')
  @ApiOperation({ summary: 'Download file by filename' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async downloadFile(
    @Param('fileName') fileName: string,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const fileInfo = await this.filesService.downloadFile(fileName, user.id);
    
    res.set({
      'Content-Type': fileInfo.fileType,
      'Content-Disposition': `attachment; filename="${fileInfo.fileName}"`,
      'Content-Length': fileInfo.fileSize.toString(),
    });

    const stream = createReadStream(fileInfo.filePath);
    stream.pipe(res);
  }

  /**
   * Get file details by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get file details by ID' })
  @ApiResponse({ status: 200, description: 'File details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.findOne(id, user.id);
  }

  /**
   * Delete file (Admin only)
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete file (Admin only)' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Only competition admin can delete files' })
  @ApiResponse({ status: 400, description: 'Cannot delete files during active competition' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.filesService.remove(id, user.id);
  }
}
