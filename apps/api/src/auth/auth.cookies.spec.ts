import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthCookies } from './auth.cookies';

describe('production authentication cookies', () => {
  it('uses host-prefixed secure cookies and clears with matching scope', () => {
    const cookies = new AuthCookies(
      new ConfigService({ NODE_ENV: 'production' }),
    );
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const response = { cookie, clearCookie } as unknown as Response;
    cookies.set(response, {
      tokens: { access: 'access', refresh: 'refresh' },
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(cookie).toHaveBeenCalledWith(
      '__Host-tc_access',
      'access',
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(cookie).toHaveBeenCalledWith(
      '__Host-tc_refresh',
      'refresh',
      expect.objectContaining({ secure: true, httpOnly: true, path: '/' }),
    );
    cookies.clear(response);
    expect(clearCookie).toHaveBeenCalledWith(
      '__Host-tc_refresh',
      expect.objectContaining({ secure: true, path: '/' }),
    );
  });
});
