import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService, type PublicUser } from './auth.service';
import { AuthCookies } from './auth.cookies';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD') return true;
    if (req.get('origin') !== this.config.getOrThrow<string>('WEB_ORIGIN')) {
      throw new ForbiddenException('Request origin is not allowed');
    }
    if (!req.is('application/json'))
      throw new UnsupportedMediaTypeException('JSON body required');
    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = await this.auth.me(this.cookies.read(req, 'access'));
    return true;
  }
}
