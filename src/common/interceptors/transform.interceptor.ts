/**
 * TRANSFORM INTERCEPTOR
 *
 * Standardizes all successful API responses with a consistent format.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // If data already has a custom format, return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If data has message and data fields (common pattern)
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data
        ) {
          return {
            success: true,
            statusCode: response.statusCode || 200,
            message: data.message,
            data: data.data,
            timestamp: new Date().toISOString(),
          };
        }

        // Standard transformation
        return {
          success: true,
          statusCode: response.statusCode || 200,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
