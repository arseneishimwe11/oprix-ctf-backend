import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Rate limiting
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10), // 1 minute
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  
  // Flag submission specific
  flagSubmissionRateLimit: parseInt(process.env.FLAG_SUBMISSION_RATE_LIMIT || '5', 10),
  flagSubmissionFailureThreshold: parseInt(process.env.FLAG_SUBMISSION_FAILURE_THRESHOLD || '3', 10),
  flagSubmissionTimeoutMinutes: parseInt(process.env.FLAG_SUBMISSION_TIMEOUT_MINUTES || '5', 10),
  
  // File upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024,
  maxChallengeFilesSize: parseInt(process.env.MAX_CHALLENGE_FILES_SIZE_MB || '500', 10) * 1024 * 1024,
  allowedFileTypes: [
    '.zip', '.tar', '.gz', '.tar.gz', '.7z',
    '.txt', '.pdf', '.md',
    '.jpg', '.jpeg', '.png', '.gif',
    '.pcap', '.pcapng',
    '.bin', '.exe', '.elf'
  ],
  
  // Feature flags
  normalizeFlags: process.env.NORMALIZE_FLAGS === 'true',
  caseSensitiveFlags: process.env.CASE_SENSITIVE_FLAGS === 'true',
  lockTeamsOnStart: process.env.LOCK_TEAMS_ON_START !== 'false',
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
}));