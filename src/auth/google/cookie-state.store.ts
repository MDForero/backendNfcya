import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'nfcya_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

type StoreCallback = (err: Error | null, state?: string) => void;
type VerifyCallback = (
  err: Error | null,
  ok: boolean,
  info?: { message: string },
) => void;

/**
 * Store del parámetro `state` de OAuth sin sesión de Express: el valor viaja en una
 * cookie httpOnly de corta duración y se compara al volver de Google.
 */
export class CookieStateStore {
  constructor(private readonly secure: boolean) {}

  store(req: Request, callback: StoreCallback) {
    const state = randomBytes(24).toString('base64url');
    (req.res as Response).cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/auth/google',
      maxAge: STATE_TTL_MS,
    });
    callback(null, state);
  }

  verify(req: Request, providedState: string, callback: VerifyCallback) {
    const expected = (req.cookies as Record<string, unknown> | undefined)?.[
      OAUTH_STATE_COOKIE
    ];
    (req.res as Response).clearCookie(OAUTH_STATE_COOKIE, {
      path: '/auth/google',
    });

    if (typeof expected !== 'string' || typeof providedState !== 'string') {
      return callback(null, false, { message: 'state ausente' });
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(providedState);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return callback(null, false, { message: 'state no coincide' });
    }
    callback(null, true);
  }
}
