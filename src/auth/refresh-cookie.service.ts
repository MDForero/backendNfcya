import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { EnvironmentVariables } from '../config/env.validation';

export const REFRESH_COOKIE = 'nfcya_rt';

/** Cookie httpOnly con el refresh token, limitada a las rutas /auth. */
@Injectable()
export class RefreshCookieService {
  private readonly base: CookieOptions;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.base = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: config.get('COOKIE_SAMESITE', { infer: true }),
      domain: config.get('COOKIE_DOMAIN', { infer: true }) || undefined,
      path: '/auth',
    };
  }

  read(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[
      REFRESH_COOKIE
    ];
    return typeof value === 'string' && value ? value : undefined;
  }

  set(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, token, { ...this.base, expires: expiresAt });
  }

  clear(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.base);
  }
}
