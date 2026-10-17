import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { REFRESH_COOKIE, RefreshCookieService } from './refresh-cookie.service';

function service(env: Record<string, unknown>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService<
    any,
    true
  >;
  return new RefreshCookieService(config);
}

function fakeResponse() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };
}

describe('RefreshCookieService', () => {
  const expires = new Date('2026-11-11T00:00:00Z');

  it('escribe una cookie httpOnly limitada a /auth con la expiración del refresh token', () => {
    const res = fakeResponse();
    service({
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'lax',
      COOKIE_DOMAIN: undefined,
    }).set(res, 'abc', expires);

    expect(res.cookie).toHaveBeenCalledWith(REFRESH_COOKIE, 'abc', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: undefined,
      path: '/auth',
      expires,
    });
  });

  it('respeta SameSite y dominio configurados', () => {
    const res = fakeResponse();
    service({
      COOKIE_SECURE: true,
      COOKIE_SAMESITE: 'none',
      COOKIE_DOMAIN: '.nfcya.com',
    }).set(res, 'abc', expires);
    expect(res.cookie.mock.calls[0][2]).toMatchObject({
      sameSite: 'none',
      domain: '.nfcya.com',
    });
  });

  it('borra la cookie con los mismos atributos de ruta y dominio', () => {
    const res = fakeResponse();
    service({
      COOKIE_SECURE: false,
      COOKIE_SAMESITE: 'lax',
      COOKIE_DOMAIN: '',
    }).clear(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      expect.objectContaining({
        path: '/auth',
        httpOnly: true,
        domain: undefined,
      }),
    );
  });

  it('lee solo valores string no vacíos', () => {
    const svc = service({});
    expect(svc.read({ cookies: { [REFRESH_COOKIE]: 'tok' } } as never)).toBe(
      'tok',
    );
    expect(
      svc.read({ cookies: { [REFRESH_COOKIE]: '' } } as never),
    ).toBeUndefined();
    expect(svc.read({ cookies: undefined } as never)).toBeUndefined();
  });
});
