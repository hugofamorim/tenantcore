import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EmailActionPurpose } from '../generated/prisma/client';

@Injectable()
export class MailService {
  private readonly transport;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASSWORD');
    this.transport = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.getOrThrow<boolean>('SMTP_SECURE'),
      requireTLS: config.getOrThrow<boolean>('SMTP_REQUIRE_TLS'),
      ...(user && pass ? { auth: { user, pass } } : {}),
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
    });
  }

  async send(to: string, purpose: EmailActionPurpose, token: string) {
    const verify = purpose === EmailActionPurpose.VERIFY_EMAIL;
    const url = new URL(
      verify ? '/verify-email' : '/reset-password',
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    );
    url.hash = new URLSearchParams({ token }).toString();
    await this.transport.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to,
      subject: verify
        ? 'Verify your TenantCore email'
        : 'Reset your TenantCore password',
      text: `${verify ? 'Confirm your email address' : 'Choose a new password'} by opening this link:\n\n${url.toString()}\n\nThis link expires in ${verify ? '30' : '15'} minutes and can be used only once. If you did not request this, you can ignore this email.`,
    });
  }

  async sendInvitation(to: string, token: string) {
    const url = new URL(
      '/invitations/accept',
      this.config.getOrThrow<string>('WEB_ORIGIN'),
    );
    url.hash = new URLSearchParams({ token }).toString();
    await this.transport.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to,
      subject: 'Your TenantCore organization invitation',
      text: `You have been invited to a TenantCore organization. Sign in with this email address (or register and verify it), then reopen this link to review and accept:\n\n${url.toString()}\n\nThis invitation expires in 24 hours and can be used only once. If you did not expect this invitation, you can ignore it.`,
    });
  }

  close() {
    this.transport.close();
  }
}
