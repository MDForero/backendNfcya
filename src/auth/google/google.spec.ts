import type { Request } from 'express';
import type { Profile } from 'passport-google-oauth20';
import { CookieStateStore, OAUTH_STATE_COOKIE } from './cookie-state.store';
import { toGoogleProfile } from './google.strategy';

function fakeReq(cookies: Record<string, string> = {}) {
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  return { req: { cookies, res } as unknown as Request, res };
}

describe('CookieStateStore', () => {
  const store = new CookieStateStore(true);

  it('genera un state aleatorio y lo guarda en una cookie httpOnly corta', () => {
    const { req, res } = fakeReq();
    const cb = jest.fn();
    store.store(req, cb);

    const state = cb.mock.calls[0][1] as string;
    expect(state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(res.cookie).toHaveBeenCalledWith(
      OAUTH_STATE_COOKIE,
      state,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        path: '/auth/google',
        maxAge: 600_000,
      }),
    );
  });

  it('acepta el state que coincide con la cookie y la borra', () => {
    const { req, res } = fakeReq({ [OAUTH_STATE_COOKIE]: 'abc123' });
    const cb = jest.fn();
    store.verify(req, 'abc123', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it.each([
    ['no coincide', { [OAUTH_STATE_COOKIE]: 'abc123' }, 'zzz999'],
    ['falta la cookie', {}, 'abc123'],
    ['distinta longitud', { [OAUTH_STATE_COOKIE]: 'abc' }, 'abc123'],
  ])('rechaza el state cuando %s', (_case, cookies, provided) => {
    const { req } = fakeReq(cookies);
    const cb = jest.fn();
    store.verify(req, provided, cb);
    expect(cb).toHaveBeenCalledWith(null, false, expect.anything());
  });
});

describe('toGoogleProfile', () => {
  const base = (json: Record<string, unknown>, extra: Partial<Profile> = {}) =>
    ({
      id: 'google-sub-1',
      displayName: 'Ana Pérez',
      _json: json,
      ...extra,
    }) as unknown as Profile;

  it('extrae sub, email, verificación y nombre', () => {
    expect(
      toGoogleProfile(base({ email: 'ana@gmail.com', email_verified: true })),
    ).toEqual({
      sub: 'google-sub-1',
      email: 'ana@gmail.com',
      emailVerified: true,
      name: 'Ana Pérez',
    });
  });

  it('trata email_verified ausente o falso como no verificado', () => {
    expect(toGoogleProfile(base({ email: 'a@gmail.com' })).emailVerified).toBe(
      false,
    );
    expect(
      toGoogleProfile(base({ email: 'a@gmail.com', email_verified: false }))
        .emailVerified,
    ).toBe(false);
    expect(
      toGoogleProfile(base({ email: 'a@gmail.com', email_verified: 'true' }))
        .emailVerified,
    ).toBe(true);
  });

  it('usa la parte local del email si no hay nombre', () => {
    const profile = base(
      { email: 'luis@gmail.com', email_verified: true },
      { displayName: '' },
    );
    expect(toGoogleProfile(profile).name).toBe('luis');
  });
});
