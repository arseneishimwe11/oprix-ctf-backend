import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateFileDto, FileQueryDto } from './dto/create-file.dto';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Files Service
 * Handles file uploads, storage, and management for CTF challenges
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedTypes: string[];

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('files.uploadPath') || './uploads';
    this.maxFileSize = this.configService.get<number>('files.maxSize') || 50 * 1024 * 1024; // 50MB
    this.allowedTypes = this.configService.get<string[]>('files.allowedTypes') || [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'text/plain',
      'application/x-executable',
    ];

    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  /**
   * Upload file for challenge
   * @param file - Uploaded file
   * @param createFileDto - File metadata
   * @param userId - User uploading (admin check)
   */
  async uploadFile(file: any, createFileDto: CreateFileDto, userId: string) {
    // Validate file
    this.validateFile(file);

    // Verify challenge exists and user has permission
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: createFileDto.challengeId },
      include: {
        competition: {
          select: {
            id: true,
            adminId: true,
            status: true,
          },
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Check if user is admin of the competition or superadmin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (
      user?.role !== 'SUPERADMIN' &&
      challenge.competition.adminId !== userId
    ) {
      throw new ForbiddenException('Only competition admin can upload files');
    }

    // Generate unique filename and calculate checksum
    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
    const filePath = path.join(this.uploadPath, uniqueFileName);
    
    // Calculate file checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    try {
      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create database record
      const fileRecord = await this.prisma.file.create({
        data: {
          challengeId: createFileDto.challengeId,
          fileName: uniqueFileName,
          originalName: file.originalname,
          fileUrl: `/api/v1/files/${uniqueFileName}`,
          fileType: file.mimetype,
          fileSize: file.size,
          checksum,
        },
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              competition: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`File uploaded: ${file.originalname} for challenge ${challenge.title}`);
      return fileRecord;
    } catch (error) {
      // Clean up file if database save fails
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        this.logger.error('Failed to clean up file after database error', unlinkError);
      }
      
      this.logger.error('Failed to save file', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Get all files with optional filtering
   * @param query - Query parameters
   * @param userId - User requesting files
   */
  async findAll(query: FileQueryDto, userId: string) {
    const { page = 1, limit = 20, challengeId, fileType } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (challengeId) where.challengeId = challengeId;
    if (fileType) where.fileType = { contains: fileType, mode: 'insensitive' };

    // Check user permissions - only show files from competitions they have access to
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'SUPERADMIN') {
      // Add filter for competitions user is admin of or registered for
      where.challenge = {
        competition: {
          OR: [
            { adminId: userId },
            { registrations: { some: { userId, status: 'APPROVED' } } },
            { isPublic: true },
          ],
        },
      };
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
              competition: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      data: files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get file by ID
   * @param id - File ID
   * @param userId - User requesting file
   */
  async findOne(id: string, userId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            competition: {
              select: {
                id: true,
                title: true,
                adminId: true,
                isPublic: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check user permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const hasPermission = 
      user?.role === 'SUPERADMIN' ||
      file.challenge.competition.adminId === userId ||
      file.challenge.competition.isPublic;

    if (!hasPermission) {
      // Check if user is registered for the competition
      const registration = await this.prisma.registration.findFirst({
        where: {
          userId,
          competitionId: file.challenge.competition.id,
          status: 'APPROVED',
        },
      });

      if (!registration) {
        throw new ForbiddenException('Access denied');
      }
    }

    return file;
  }

  /**
   * Download file by filename
   * @param fileName - File name
   * @param userId - User downloading
   */
  async downloadFile(fileName: string, userId: string) {
    // Find file record by filename
    const file = await this.prisma.file.findFirst({
      where: { fileName },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            competition: {
              select: {
                id: true,
                adminId: true,
                isPublic: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check permissions (same as findOne)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const hasPermission = 
      user?.role === 'SUPERADMIN' ||
      file.challenge.competition.adminId === userId ||
      (file.challenge.competition.isPublic && file.challenge.competition.status === 'ACTIVE');

    if (!hasPermission) {
      const registration = await this.prisma.registration.findFirst({
        where: {
          userId,
          competitionId: file.challenge.competition.id,
          status: 'APPROVED',
        },
      });

      if (!registration) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Check if file exists on disk
    const filePath = path.join(this.uploadPath, fileName);
    try {
      await fs.access(filePath);
      return {
        filePath,
        fileName: file.originalName,
        fileType: file.fileType,
        fileSize: file.fileSize,
      };
    } catch (error) {
      this.logger.error(`File not found on disk: ${filePath}`);
      throw new NotFoundException('File not found on server');
    }
  }

  /**
   * Delete file (admin only)
   * @param id - File ID
   * @param userId - User deleting file
   */
  async remove(id: string, userId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id },
      include: {
        challenge: {
          include: {
            competition: {
              select: {
                adminId: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (
      user?.role !== 'SUPERADMIN' &&
      file.challenge.competition.adminId !== userId
    ) {
      throw new ForbiddenException('Only competition admin can delete files');
    }

    // Cannot delete during active competition
    if (file.challenge.competition.status === 'ACTIVE') {
      throw new BadRequestException('Cannot delete files during active competition');
    }

    try {
      // Delete from database first
      await this.prisma.file.delete({
        where: { id },
      });

      // Delete from disk
      const filePath = path.join(this.uploadPath, file.fileName);
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        this.logger.warn(`Failed to delete file from disk: ${filePath}`);
      }

      this.logger.log(`File deleted: ${file.originalName}`);
      return { message: 'File deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete file', error);
      throw new BadRequestException('Failed to delete file');
    }
  }

  /**
   * Get files for specific challenge
   * @param challengeId - Challenge ID
   * @param userId - User requesting files
   */
  async getChallengFiles(challengeId: string, userId: string) {
    // Verify challenge exists and user has access
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        competition: {
          select: {
            id: true,
            adminId: true,
            isPublic: true,
            status: true,
          },
        },
      },
    });

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const hasPermission = 
      user?.role === 'SUPERADMIN' ||
      challenge.competition.adminId === userId ||
      (challenge.competition.isPublic && challenge.competition.status === 'ACTIVE');

    if (!hasPermission) {
      const registration = await this.prisma.registration.findFirst({
        where: {
          userId,
          competitionId: challenge.competition.id,
          status: 'APPROVED',
        },
      });

      if (!registration) {
        throw new ForbiddenException('Access denied');
      }
    }

    const files = await this.prisma.file.findMany({
      where: { challengeId },
      orderBy: { createdAt: 'asc' },
    });

    return files;
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: any) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch (error) {
      try {
        await fs.mkdir(this.uploadPath, { recursive: true });
        this.logger.log(`Created upload directory: ${this.uploadPath}`);
      } catch (createError) {
        this.logger.error('Failed to create upload directory', createError);
        throw new Error('Failed to initialize file storage');
      }
    }
  }
}
