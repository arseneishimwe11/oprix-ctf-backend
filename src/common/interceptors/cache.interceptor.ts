import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Custom cache interceptor for flexible caching strategies
 * Can be extended with Redis integration
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `${request.method}-${request.url}`;

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cachedResponse = this.cache.get(key);
    if (cachedResponse) {
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap((response) => {
        this.cache.set(key, response);
        // Simple TTL - clears after 5 minutes
        setTimeout(() => this.cache.delete(key), 5 * 60 * 1000);
      }),
    );
  }
}