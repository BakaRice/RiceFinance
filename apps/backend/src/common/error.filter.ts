import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorCode } from './error.codes';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      const status = this.mapCodeToStatus(exception.code);
      return response.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message = typeof res === 'string' ? res : (res as any).message || 'Validation failed';
      const code = status === 400 ? ErrorCode.VALIDATION_ERROR : ErrorCode.INTERNAL_ERROR;
      return response.status(status).json({
        error: { code, message, details: Array.isArray(message) ? message : undefined },
      });
    }

    this.logger.error('Unhandled exception', exception as Error);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
    });
  }

  private mapCodeToStatus(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR: return 400;
      case ErrorCode.UNAUTHORIZED: return 401;
      case ErrorCode.FORBIDDEN: return 403;
      case ErrorCode.NOT_FOUND: return 404;
      case ErrorCode.CONFLICT: return 409;
      case ErrorCode.AI_SERVICE_ERROR: return 502;
      default: return 500;
    }
  }
}
