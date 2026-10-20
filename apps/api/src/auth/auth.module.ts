import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { AuthCookies } from './auth.cookies';
import { AuthOriginGuard, SessionGuard } from './auth.guards';
import { MailService } from './mail.service';
import { EmailActionsService } from './email-actions.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AuthCookies,
    AuthOriginGuard,
    SessionGuard,
    MailService,
    EmailActionsService,
  ],
})
export class AuthModule {}
