import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Validation exception filter
 * Formats validation errors from class-validator
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract validation errors
    const validationErrors =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? exceptionResponse.message
        : 'Validation failed';

    // Log validation error
    this.logger.warn(
      `Validation Error: ${JSON.stringify(validationErrors)}`,
      `${request.method} ${request.url}`,
    );

    // Format response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 'Validation failed',
      errors: Array.isArray(validationErrors) ? validationErrors : [validationErrors],
    };

    response.status(status).json(errorResponse);
  }
}