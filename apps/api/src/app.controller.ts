import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    await this.checkDatabase();
    return { status: 'ok' };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
          await tx.$queryRaw`SELECT 1`;
        },
        { maxWait: 2000, timeout: 3000 },
      );
    } catch {
      throw new ServiceUnavailableException('Service temporarily unavailable');
    }
  }

  @Get('health')
  async health() {
    try {
      await this.checkDatabase();

      return {
        status: 'ok',
        service: 'tenantcore-api',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Service temporarily unavailable');
    }
  }
}
