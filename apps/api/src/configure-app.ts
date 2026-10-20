import {
  BadRequestException,
  PayloadTooLargeException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requestContext } from './operations/request-context';
import { SafeExceptionFilter } from './operations/safe-exception.filter';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.use(requestContext());
  app.useGlobalFilters(new SafeExceptionFilter());
  app.use(json({ limit: '16kb' }));
  // Sanitize parser errors before Nest's adapter converts SyntaxError.message
  // into a public BadRequestException (which could contain submitted body text).
  app.use(
    (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
      if (
        error instanceof SyntaxError ||
        (error &&
          typeof error === 'object' &&
          'type' in error &&
          error.type === 'entity.parse.failed')
      )
        next(new BadRequestException('Invalid JSON body'));
      else if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'entity.too.large'
      )
        next(new PayloadTooLargeException('Request body too large'));
      else next(error);
    },
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });
}
