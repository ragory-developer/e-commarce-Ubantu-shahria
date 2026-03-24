import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = null;

    // ✅ Added (safe enhancement)
    const requestId = request.headers['x-request-id'] || null;
    const isProduction = process.env.NODE_ENV === 'production';

    // ─── NestJS HTTP Exceptions ──────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, any>;

        // ✅ Validation error (array format)
        if (Array.isArray(res.message)) {
          status = HttpStatus.BAD_REQUEST;
          message = 'Validation failed';
          errors = res.message;
        } else {
          message =
            typeof res.message === 'string' ? res.message : exception.message;

          errors = res.errors ?? null;
        }
      }
    }

    // ─── Prisma Known Errors ─────────────
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(', ');
          message = `Duplicate entry for: ${target || 'unknown field'}`;
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        }
        default: {
          message = `Database error: ${exception.code}`;
        }
      }
    }

    // ─── Prisma Validation Errors ────────
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
    }

    // ─── Unknown Errors ──────────────────
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // ✅ Hide internal error details in production
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Something went wrong';
    }

    // ✅ Improved logging (more readable)
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status} | ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      path: request.url,
      requestId, // ✅ added (optional but powerful)
      timestamp: new Date().toISOString(),
    });
  }
}
