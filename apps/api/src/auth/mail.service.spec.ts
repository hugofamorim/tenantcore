import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';
import { EmailActionPurpose } from '../generated/prisma/client';

describe('MailService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses bounded SMTP with the configured TLS policy and no debug logging', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const close = jest.fn();
    const create = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail, close } as unknown as ReturnType<
        typeof nodemailer.createTransport
      >);
    const service = new MailService(
      new ConfigService({
        SMTP_HOST: 'smtp.example.test',
        SMTP_PORT: 587,
        SMTP_FROM: 'noreply@example.test',
        SMTP_SECURE: false,
        SMTP_REQUIRE_TLS: true,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'fixture-password',
        WEB_ORIGIN: 'https://tenantcore.example.test',
      }),
    );
    await service.send(
      'user@example.test',
      EmailActionPurpose.RESET_PASSWORD,
      'fixture-token',
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        requireTLS: true,
        secure: false,
        logger: false,
        debug: false,
        maxConnections: 2,
        connectionTimeout: 5000,
      }),
    );
    const message = sendMail.mock.calls[0][0] as {
      text: string;
      subject: string;
    };
    expect(message.text).toContain(
      'https://tenantcore.example.test/reset-password#token=fixture-token',
    );
    expect(message.text).not.toContain('?token=');
    expect(message.subject).toBe('Reset your TenantCore password');
    service.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
