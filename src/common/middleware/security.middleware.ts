import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';

/**
 * Security middleware
 * Applies helmet and compression
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  private compressionMiddleware = compression();

  use(req: Request, res: Response, next: NextFunction) {
    // Apply helmet
    this.helmetMiddleware(req, res, (err?: any) => {
      if (err) return next(err);
      // Apply compression
      this.compressionMiddleware(req, res, next);
    });
  }
}