import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      // ValidationPipe (class-validator) throws a BadRequestException whose
      // .message is just the generic "Bad Request Exception" — the actual
      // per-field messages live in .getResponse().message, as a string or
      // an array of strings. Every 400 in the app was silently losing its
      // real reason until this unwrapped it.
      const rawMessage =
        typeof response === 'object' && response !== null && 'message' in response
          ? (response as { message: string | string[] }).message
          : exception.message;
      const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;

      res.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Anything else (Prisma errors, unexpected throws) — log it and respond
    // with a generic 500 instead of letting it surface as an unhandled error.
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again.',
      timestamp: new Date().toISOString(),
    });
  }
}
