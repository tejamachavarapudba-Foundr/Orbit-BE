import { CallHandler, ExecutionContext, Injectable, NestInterceptor, RequestTimeoutException } from '@nestjs/common';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

const REQUEST_TIMEOUT_MS = 25_000;

// File uploads (pitch videos up to 50MB, resumes, images, etc.) go through
// this same interceptor chain via FileInterceptor/FilesInterceptor — the
// multipart body is still being parsed while this runs, so a slow upload on
// a weak connection can legitimately exceed the normal request budget.
const UPLOAD_TIMEOUT_MS = 120_000;

// Without this, a hung downstream call (a stuck query, a stalled call to
// S3/Twilio/Resend) ties up the request for however long Node's own
// defaults allow (minutes), instead of failing fast with a clean error the
// client already knows how to handle.
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const contentType: string = request?.headers?.['content-type'] ?? '';
    const budget = contentType.startsWith('multipart/form-data') ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

    return next.handle().pipe(
      timeout(budget),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('The request took too long to process.'));
        }
        return throwError(() => error);
      }),
    );
  }
}
