import { ExecutionContext } from '@nestjs/common';
import { OAUTH_STATE_COOKIE } from '../src/auth/google/cookie-state.store';
import { GoogleAuthGuard } from '../src/auth/google/google-auth.guard';
import type { GoogleProfile } from '../src/auth/google/google.strategy';
import { REFRESH_COOKIE } from '../src/auth/refresh-cookie.service';
import { Role, UserStatus } from '../src/users/role.enum';
import { UserIdentity } from '../src/users/user-identity.entity';
import { User } from '../src/users/user.entity';
import {
  createOrganization,
  createTestApp,
  createUser,
  PASSWORD,
  rawSetCookie,
  refreshCookieOf,
  resetDb,
  TestContext,
  waitForMail,
} from './utils';

const FRONTEND_CALLBACK = 'http://localhost:3000/auth/callback';

describe('Login con Google: inicio del flujo (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());

  it('redirige a Google con state y lo guarda en una cookie httpOnly', async () => {
    const res = await ctx.http().get('/auth/google').expect(302);
    const location = new URL(res.headers.location);

    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe('test-client-id');
    expect(location.searchParams.get('scope')).toBe('openid email profile');
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(rawSetCookie(res, OAUTH_STATE_COOKIE)).toContain(
      `${OAUTH_STATE_COOKIE}=${state}`,
    );
  });

  it('un callback con state manipulado redirige al frontend con error y sin sesión', async () => {
    const res = await ctx
      .http()
      .get('/auth/google/callback?code=abc&state=falso')
      .set('Cookie', `${OAUTH_STATE_COOKIE}=otro`)
      .expect(302);
    expect(res.headers.location).toBe(
      `${FRONTEND_CALLBACK}?error=oauth_failed`,
    );
    expect(refreshCookieOf(res)).toBeUndefined();
  });

  it('si el usuario cancela en Google redirige con error y sin sesión', async () => {
    const res = await ctx
      .http()
      .get('/auth/google/callback?error=access_denied')
      .expect(302);
    expect(res.headers.location).toBe(
      `${FRONTEND_CALLBACK}?error=oauth_failed`,
    );
    expect(refreshCookieOf(res)).toBeUndefined();
  });
});

/**
 * El intercambio de código con Google se sustituye por un guard que inyecta un perfil
 * simulado (cabecera x-test-google-profile); el resto del callback es el real.
 */
describe('Login con Google: resolución de cuenta en el callback (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideGuard(GoogleAuthGuard).useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user?: unknown }>();
          req.user = JSON.parse(
            req.headers['x-test-google-profile'],
          ) as GoogleProfile;
          return true;
        },
      }),
    );
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const profile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
    sub: 'google-sub-1',
    email: 'ana@gmail.com',
    emailVerified: true,
    name: 'Ana Google',
    ...overrides,
  });

  const callback = (p: GoogleProfile) =>
    ctx
      .http()
      .get('/auth/google/callback')
      .set('x-test-google-profile', JSON.stringify(p))
      .expect(302);

  const identities = () => ctx.db.getRepository(UserIdentity);
  const users = () => ctx.db.getRepository(User);

  it('primer acceso: crea un CLIENTE verificado sin contraseña y abre sesión', async () => {
    const res = await callback(profile());

    expect(res.headers.location).toBe(FRONTEND_CALLBACK);
    const refresh = refreshCookieOf(res)!;
    expect(refresh).toBeDefined();

    const user = await users().findOneByOrFail({ email: 'ana@gmail.com' });
    expect(user.role).toBe(Role.CLIENTE);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(
      await identities().countBy({ userId: user.id, provider: 'google' }),
    ).toBe(1);

    // El frontend obtiene el access token con la cookie, nunca por la URL.
    expect(res.headers.location).not.toMatch(/token/i);
    const session = await ctx
      .http()
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
      .expect(200);
    expect(session.body.user).toMatchObject({
      email: 'ana@gmail.com',
      providers: ['google'],
    });
  });

  it('vincula Google a una cuenta existente con el mismo email, conservando rol y organización', async () => {
    const org = await createOrganization(ctx);
    const existing = await createUser(ctx, {
      email: 'ana@gmail.com',
      role: Role.EMPRESA,
      organizationId: org.id,
      verified: false,
    });

    const res = await callback(profile());
    expect(res.headers.location).toBe(FRONTEND_CALLBACK);

    const user = await users().findOneByOrFail({ id: existing.id });
    expect(user.role).toBe(Role.EMPRESA);
    expect(user.organizationId).toBe(org.id);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await users().count()).toBe(1);
    await waitForMail(ctx, 'ana@gmail.com', 'Vinculaste Google');

    // Sigue pudiendo entrar con contraseña.
    await ctx
      .http()
      .post('/auth/login')
      .send({ email: 'ana@gmail.com', password: PASSWORD })
      .expect(200);
  });

  it('un segundo acceso usa la identidad vinculada aunque cambie el email en Google', async () => {
    await callback(profile());
    await callback(profile({ email: 'nuevo@gmail.com' }));
    expect(await users().count()).toBe(1);
    expect(await identities().count()).toBe(1);
  });

  it('rechaza un email no verificado por Google sin crear ni vincular nada', async () => {
    await createUser(ctx, { email: 'ana@gmail.com' });
    const res = await callback(profile({ emailVerified: false }));

    expect(res.headers.location).toBe(
      `${FRONTEND_CALLBACK}?error=email_not_verified`,
    );
    expect(refreshCookieOf(res)).toBeUndefined();
    expect(await identities().count()).toBe(0);
    expect(await users().count()).toBe(1);
  });

  it.each([
    ['por email', false],
    ['por identidad ya vinculada', true],
  ])('rechaza una cuenta suspendida (%s)', async (_case, alreadyLinked) => {
    const user = await createUser(ctx, {
      email: 'ana@gmail.com',
      status: UserStatus.SUSPENDIDA,
    });
    if (alreadyLinked) {
      await identities().save(
        identities().create({
          userId: user.id,
          provider: 'google',
          providerUserId: 'google-sub-1',
        }),
      );
    }

    const res = await callback(profile());
    expect(res.headers.location).toBe(
      `${FRONTEND_CALLBACK}?error=account_suspended`,
    );
    expect(refreshCookieOf(res)).toBeUndefined();
  });
});
