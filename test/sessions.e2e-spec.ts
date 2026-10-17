import { JwtService } from '@nestjs/jwt';
import { REFRESH_COOKIE } from '../src/auth/refresh-cookie.service';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createOrganization,
  createTestApp,
  createUser,
  login,
  PASSWORD,
  rawSetCookie,
  refreshCookieOf,
  resetDb,
  TestContext,
  userSession,
} from './utils';

describe('Inicio de sesión y sesiones (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const postLogin = (email: string, password: string) =>
    ctx.http().post('/auth/login').send({ email, password });

  describe('POST /auth/login', () => {
    it('con credenciales correctas devuelve access token, cookie de refresh y datos básicos', async () => {
      const org = await createOrganization(ctx, 'Acme');
      const user = await createUser(ctx, {
        email: 'ana@example.com',
        name: 'Ana',
        organizationId: org.id,
      });

      const res = await postLogin('ANA@example.com', PASSWORD).expect(200);

      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: user.id,
          name: 'Ana',
          email: 'ana@example.com',
          role: Role.CLIENTE,
          organization: { id: org.id, name: 'Acme' },
        },
      });
      expect(typeof res.body.accessToken).toBe('string');
      expect(refreshCookieOf(res)).toBeDefined();
    });

    it('el access token dura 15 minutos y lleva sub y role', async () => {
      const { accessToken, user } = await userSession(ctx);
      const payload = ctx.app
        .get(JwtService)
        .decode<{ sub: string; role: Role; iat: number; exp: number }>(
          accessToken,
        );
      expect(payload).toMatchObject({ sub: user.id, role: Role.CLIENTE });
      expect(payload.exp - payload.iat).toBe(900);
    });

    it('la cookie de refresh es httpOnly, en /auth y vence a los 30 días', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const res = await postLogin('ana@example.com', PASSWORD).expect(200);
      const cookie = rawSetCookie(res, REFRESH_COOKIE)!;

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/auth');
      expect(cookie).toContain('SameSite=Lax');
      const expires = new Date(/Expires=([^;]+)/.exec(cookie)![1]).getTime();
      expect((expires - Date.now()) / 86_400_000).toBeCloseTo(30, 0);
    });

    it('responde 401 con el mismo mensaje si el email no existe o la contraseña no coincide', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const wrongPassword = await postLogin(
        'ana@example.com',
        'Incorrecta1',
      ).expect(401);
      const unknownEmail = await postLogin(
        'nadie@example.com',
        'Incorrecta1',
      ).expect(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('rechaza un email sin verificar indicándolo', async () => {
      await createUser(ctx, { email: 'ana@example.com', verified: false });
      const res = await postLogin('ana@example.com', PASSWORD).expect(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('rechaza una cuenta suspendida indicándolo', async () => {
      await createUser(ctx, {
        email: 'ana@example.com',
        status: UserStatus.SUSPENDIDA,
      });
      const res = await postLogin('ana@example.com', PASSWORD).expect(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('una cuenta creada solo con Google no puede entrar con contraseña', async () => {
      await createUser(ctx, { email: 'g@example.com', password: null });
      await postLogin('g@example.com', PASSWORD).expect(401);
    });
  });

  describe('límite de intentos', () => {
    it('tras 5 fallos en 15 minutos bloquea al email aun con la contraseña correcta', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      for (let i = 0; i < 5; i++)
        await postLogin('ana@example.com', 'Incorrecta1').expect(401);

      const res = await postLogin('ana@example.com', PASSWORD).expect(429);
      expect(res.body.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('el bloqueo expira cuando los fallos salen de la ventana de 15 minutos', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      for (let i = 0; i < 5; i++)
        await postLogin('ana@example.com', 'Incorrecta1').expect(401);
      await ctx.db.query(
        `UPDATE login_attempts SET created_at = now() - interval '16 minutes'`,
      );

      await postLogin('ana@example.com', PASSWORD).expect(200);
    });

    it('un inicio de sesión exitoso reinicia el conteo', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      for (let i = 0; i < 4; i++)
        await postLogin('ana@example.com', 'Incorrecta1').expect(401);
      await postLogin('ana@example.com', PASSWORD).expect(200);
      for (let i = 0; i < 4; i++)
        await postLogin('ana@example.com', 'Incorrecta1').expect(401);
      await postLogin('ana@example.com', PASSWORD).expect(200);
    });

    it('el bloqueo es por email: no afecta a otras cuentas', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      await createUser(ctx, { email: 'luis@example.com' });
      for (let i = 0; i < 5; i++)
        await postLogin('ana@example.com', 'Incorrecta1').expect(401);
      await postLogin('luis@example.com', PASSWORD).expect(200);
    });
  });

  describe('POST /auth/refresh', () => {
    const refresh = (cookie?: string) => {
      const req = ctx.http().post('/auth/refresh');
      return cookie ? req.set('Cookie', cookie) : req;
    };

    it('emite un par nuevo e invalida el refresh token usado', async () => {
      const session = await userSession(ctx);
      const res = await refresh(session.cookie).expect(200);

      const newToken = refreshCookieOf(res);
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(session.refreshToken);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user.id).toBe(session.user.id);

      await refresh(`${REFRESH_COOKIE}=${newToken}`).expect(200);
    });

    it('sin cookie o con un token desconocido responde 401', async () => {
      await refresh().expect(401);
      await refresh(`${REFRESH_COOKIE}=inventado`).expect(401);
    });

    it('reutilizar un token ya rotado revoca todas las sesiones del usuario', async () => {
      const first = await userSession(ctx, { email: 'ana@example.com' });
      const other = await login(ctx, 'ana@example.com'); // otra sesión (otro dispositivo)

      const rotated = await refresh(first.cookie).expect(200);
      const current = `${REFRESH_COOKIE}=${refreshCookieOf(rotated)}`;

      const reuse = await refresh(first.cookie).expect(401);
      expect(reuse.body.code).toBe('INVALID_SESSION');

      await refresh(current).expect(401);
      await refresh(other.cookie).expect(401);
      const live = await ctx.db.query(
        'SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
        [first.user.id],
      );
      expect(live[0].n).toBe(0);
    });

    it('un token vencido responde 401', async () => {
      const session = await userSession(ctx);
      await ctx.db.query(
        `UPDATE refresh_tokens SET expires_at = now() - interval '1 second'`,
      );
      await refresh(session.cookie).expect(401);
    });

    it('una cuenta suspendida no puede renovar', async () => {
      const session = await userSession(ctx);
      await ctx.db
        .getRepository(User)
        .update({ id: session.user.id }, { status: UserStatus.SUSPENDIDA });
      await refresh(session.cookie).expect(401);
    });

    it('un fallo de renovación borra la cookie', async () => {
      const res = await refresh(`${REFRESH_COOKIE}=inventado`).expect(401);
      expect(rawSetCookie(res, REFRESH_COOKIE)).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });
  });

  describe('cierre de sesión', () => {
    it('logout revoca el refresh token de la sesión actual y borra la cookie', async () => {
      const session = await userSession(ctx);
      const res = await ctx
        .http()
        .post('/auth/logout')
        .set(session.auth)
        .set('Cookie', session.cookie)
        .expect(204);

      expect(rawSetCookie(res, REFRESH_COOKIE)).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
    });

    it('logout no afecta a otras sesiones del mismo usuario', async () => {
      const a = await userSession(ctx, { email: 'ana@example.com' });
      const b = await login(ctx, 'ana@example.com');
      await ctx
        .http()
        .post('/auth/logout')
        .set(a.auth)
        .set('Cookie', a.cookie)
        .expect(204);
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', b.cookie)
        .expect(200);
    });

    it('logout-all revoca todas las sesiones', async () => {
      const a = await userSession(ctx, { email: 'ana@example.com' });
      const b = await login(ctx, 'ana@example.com');
      await ctx.http().post('/auth/logout-all').set(a.auth).expect(204);
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', a.cookie)
        .expect(401);
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', b.cookie)
        .expect(401);
    });

    it('logout exige estar autenticado', async () => {
      await ctx.http().post('/auth/logout').expect(401);
    });
  });

  describe('/users/me', () => {
    it('devuelve los datos propios sin secretos', async () => {
      const session = await userSession(ctx, {
        email: 'ana@example.com',
        name: 'Ana',
      });
      const res = await ctx
        .http()
        .get('/users/me')
        .set(session.auth)
        .expect(200);

      expect(res.body).toEqual({
        id: session.user.id,
        email: 'ana@example.com',
        name: 'Ana',
        emailVerified: true,
        role: Role.CLIENTE,
        status: UserStatus.ACTIVA,
        organization: null,
        providers: ['password'],
        createdAt: expect.any(String),
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/password_?hash|argon2|token/i);
    });

    it('PATCH actualiza solo el nombre', async () => {
      const session = await userSession(ctx, { email: 'ana@example.com' });
      const res = await ctx
        .http()
        .patch('/users/me')
        .set(session.auth)
        .send({
          name: '  Ana María ',
          email: 'otro@example.com',
          role: Role.SUPER_ADMIN,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        name: 'Ana María',
        email: 'ana@example.com',
        role: Role.CLIENTE,
      });
    });

    it('PATCH valida el nombre', async () => {
      const session = await userSession(ctx);
      await ctx
        .http()
        .patch('/users/me')
        .set(session.auth)
        .send({ name: 'A' })
        .expect(400);
    });
  });
});
