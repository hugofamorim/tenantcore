import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const queryRaw = jest.fn(() => Promise.resolve([{ '?column?': 1 }]));
  const executeRaw = jest.fn(() => Promise.resolve(0));
  const transaction = jest.fn(
    async (
      callback: (tx: {
        $queryRaw: typeof queryRaw;
        $executeRaw: typeof executeRaw;
      }) => Promise<void>,
    ) => callback({ $queryRaw: queryRaw, $executeRaw: executeRaw }),
  );

  beforeEach(async () => {
    queryRaw.mockClear();
    executeRaw.mockClear();
    transaction.mockClear();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PrismaService, useValue: { $transaction: transaction } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns a healthy response when the database is reachable', async () => {
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        service: 'tenantcore-api',
        database: 'connected',
        timestamp: expect.any(String),
      });
      expect(queryRaw).toHaveBeenCalledWith(['SELECT 1']);
      expect(executeRaw).toHaveBeenCalledWith([
        "SET LOCAL statement_timeout = '2000ms'",
      ]);
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 2000,
        timeout: 3000,
      });
    });

    it('returns a 503 error when the database query fails', async () => {
      queryRaw.mockRejectedValueOnce(new Error('Database unavailable'));

      await expect(appController.health()).rejects.toMatchObject({
        status: 503,
        response: expect.objectContaining({
          statusCode: 503,
          message: 'Service temporarily unavailable',
        }),
      });
    });
  });

  it('does not depend on PostgreSQL for liveness', () => {
    expect(appController.live()).toEqual({ status: 'ok' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns minimal readiness without connection diagnostics', async () => {
    await expect(appController.ready()).resolves.toEqual({ status: 'ok' });
    queryRaw.mockRejectedValueOnce(new Error('private connection diagnostic'));
    await expect(appController.ready()).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 503,
        message: 'Service temporarily unavailable',
      }),
    });
  });
});
