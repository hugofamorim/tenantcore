import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestLocals } from './request-context';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Pick<Logger, 'error'> = new Logger('HTTP'),
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host
      .switchToHttp()
      .getResponse<Response<unknown, RequestLocals>>();
    if (response.headersSent) return;
    let status = 500;
    let body: unknown = { statusCode: 500, message: 'Internal server error' };
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const value = exception.getResponse();
      if (status < 500) {
        body =
          typeof value === 'string'
            ? { statusCode: status, message: value }
            : value;
        if (
          status === 400 &&
          typeof value === 'object' &&
          value !== null &&
          'message' in value &&
          typeof value.message === 'string' &&
          value.message.startsWith('Failed to decode param')
        )
          body = { statusCode: 400, message: 'Invalid request path' };
        if (
          status === 404 &&
          typeof value === 'object' &&
          value !== null &&
          'message' in value &&
          typeof value.message === 'string' &&
          value.message.startsWith('Cannot ')
        ) {
          body = { statusCode: 404, message: 'Resource not found' };
        }
      } else
        body = {
          statusCode: status,
          message:
            status === 503
              ? 'Service temporarily unavailable'
              : 'Internal server error',
        };
    } else if (
      exception &&
      typeof exception === 'object' &&
      'type' in exception
    ) {
      if (exception.type === 'entity.too.large') {
        status = 413;
        body = { statusCode: 413, message: 'Request body too large' };
      }
      if (exception.type === 'entity.parse.failed') {
        status = 400;
        body = { statusCode: 400, message: 'Invalid JSON body' };
      }
    }
    if (status >= 500)
      this.logger.error({
        event: 'http_error',
        requestId: response.locals.requestId,
        status,
      });
    response.status(status).json(body);
  }
}
