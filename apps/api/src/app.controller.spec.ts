import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const queryRaw = jest.fn(() => Promise.resolve([{ '?column?': 1 }]));

  beforeEach(async () => {
    queryRaw.mockClear();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
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
    });

    it('returns a 503 error when the database query fails', async () => {
      queryRaw.mockRejectedValueOnce(new Error('Database unavailable'));

      await expect(appController.health()).rejects.toMatchObject({
        status: 503,
        response: { status: 'error', database: 'unavailable' },
      });
    });
  });
});
