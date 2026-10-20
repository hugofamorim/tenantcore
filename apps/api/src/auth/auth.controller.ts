import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
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
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
@UseGuards(AuthOriginGuard, ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
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
}
