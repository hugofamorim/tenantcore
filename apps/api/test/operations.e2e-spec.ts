import { Controller, Get, Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import { configureApp } from '../src/configure-app';

@Controller('probe')
class ProbeController {
  @Get('fail') fail() {
    throw new Error('private-diagnostic fixture-password postgres://private');
  }
  @Get(':resource') ok() {
    return { status: 'ok' };
  }
}

describe('safe request telemetry over real HTTP', () => {
  let app: INestApplication<App>;
  let records: jest.SpyInstance;
  let errors: jest.SpyInstance;
  beforeEach(async () => {
    records = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({ WEB_ORIGIN: 'http://localhost:3000' }),
        },
      ],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });
  afterEach(async () => {
    if (app) await app.close();
    jest.restoreAllMocks();
  });
  it('generates server IDs and records route templates without raw parameters, queries or cookies', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/private-token?email=private@example.test')
      .set('X-Request-Id', 'untrusted-id')
      .set('Cookie', 'tc_access=private-cookie')
      .expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(records).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request',
        route: '/probe/:resource',
        status: 200,
        requestId: response.headers['x-request-id'],
      }),
    );
    const serialized = JSON.stringify(records.mock.calls);
    for (const secret of [
      'private-token',
      'private@example.test',
      'private-cookie',
      'untrusted-id',
    ])
      expect(serialized).not.toContain(secret);
  });
  it('never echoes an unmatched URL containing a secret in public 404 or logs', async () => {
    const response = await request(app.getHttpServer())
      .get('/private-reset-secret?token=private-token')
      .expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Resource not found',
    });
    expect(JSON.stringify(records.mock.calls)).not.toContain(
      'private-reset-secret',
    );
  });
  it('correlates internal errors without leaking exception messages or stack traces', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/fail')
      .expect(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(errors).toHaveBeenCalledWith({
      event: 'http_error',
      status: 500,
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(errors.mock.calls)).not.toContain(
      'private-diagnostic',
    );
  });
  it('keeps malformed JSON and payload limits with no raw body echo', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/probe/fail')
      .type('json')
      .send('{"secret":"private-body"')
      .expect(400);
    expect(malformed.body).toEqual({
      statusCode: 400,
      message: 'Invalid JSON body',
      error: 'Bad Request',
    });
    await request(app.getHttpServer())
      .post('/probe/fail')
      .send({ secret: 'x'.repeat(17_000) })
      .expect(413);
    expect(JSON.stringify(records.mock.calls)).not.toContain('private-body');
  });
});
