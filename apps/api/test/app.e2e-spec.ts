import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/configure-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  it('/health (GET) verifies the real database', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }: { body: unknown }) => {
        expect(body).toEqual({
          status: 'ok',
          service: 'tenantcore-api',
          database: 'connected',
          timestamp: expect.any(String),
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
