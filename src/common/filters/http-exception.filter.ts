import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({
        statusCode: status,
        message: exception.message,
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
