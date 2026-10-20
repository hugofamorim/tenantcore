import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { ACCESS_LIFETIME_MS } from './auth.service';

@Injectable()
export class AuthCookies {
  constructor(private readonly config: ConfigService) {}

  private name(kind: 'access' | 'refresh') {
    return `${this.config.get('NODE_ENV') === 'production' ? '__Host-' : ''}tc_${kind}`;
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  read(req: Request, kind: 'access' | 'refresh'): string | undefined {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[this.name(kind)];
    return typeof token === 'string' ? token : undefined;
  }

  set(
    res: Response,
    session: { tokens: { access: string; refresh: string }; expiresAt: Date },
  ) {
    res.cookie(this.name('access'), session.tokens.access, {
      ...this.options(),
      maxAge: Math.min(
        ACCESS_LIFETIME_MS,
        session.expiresAt.getTime() - Date.now(),
      ),
    });
    res.cookie(this.name('refresh'), session.tokens.refresh, {
      ...this.options(),
      expires: session.expiresAt,
    });
  }

  clear(res: Response) {
    for (const kind of ['access', 'refresh'] as const)
      res.clearCookie(this.name(kind), this.options());
  }
}
