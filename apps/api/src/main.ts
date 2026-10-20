import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  configureApp(app);
  app.enableShutdownHooks();
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  const host = app.get(ConfigService).getOrThrow<string>('API_HOST');
  await app.listen(port, host);

  new Logger('Bootstrap').log({ event: 'api_started', host, port });
}

void bootstrap();
