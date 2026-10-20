import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthCookies } from './auth.cookies';
import {
  AuthOriginGuard,
  type AuthenticatedRequest,
  SessionGuard,
} from './auth.guards';
import {
  EmailDto,
  EmailTokenDto,
  LoginDto,
  RegisterDto,
  AccountNameDto,
  ResetPasswordDto,
} from './auth.dto';
import { EmailActionsService } from './email-actions.service';
import { EmailActionPurpose } from '../generated/prisma/client';

@Controller('auth')
@UseGuards(AuthOriginGuard, ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
    private readonly emailActions: EmailActionsService,
  ) {}

  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.cookies.set(res, await this.auth.login(input));
  }

  @Post('refresh')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      this.cookies.set(
        res,
        await this.auth.refresh(this.cookies.read(req, 'refresh')),
      );
    } catch (error) {
      this.cookies.clear(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(
      this.cookies.read(req, 'access'),
      this.cookies.read(req, 'refresh'),
    );
    this.cookies.clear(res);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  me(@Req() req: AuthenticatedRequest) {
    return { user: req.user };
  }

  @Patch('me')
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  updateName(@Req() req: AuthenticatedRequest, @Body() input: AccountNameDto) {
    if (!req.user) throw new Error('Session guard did not provide identity');
    return this.auth.updateName(req.user.id, input.name);
  }

  @Post('resend-verification')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resendVerification(@Body() input: EmailDto) {
    return this.emailActions.request(
      input.email,
      EmailActionPurpose.VERIFY_EMAIL,
    );
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() input: EmailDto) {
    return this.emailActions.request(
      input.email,
      EmailActionPurpose.RESET_PASSWORD,
    );
  }

  @Post('verify-email')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async verifyEmail(@Body() input: EmailTokenDto) {
    await this.emailActions.verifyEmail(input.token);
  }

  @Post('reset-password')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async resetPassword(
    @Body() input: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.emailActions.resetPassword(input.token, input.password);
    this.cookies.clear(res);
  }
}
