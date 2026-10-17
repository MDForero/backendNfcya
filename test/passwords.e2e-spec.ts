import { OneTimeToken } from '../src/auth/entities/one-time-token.entity';
import { REFRESH_COOKIE } from '../src/auth/refresh-cookie.service';
import {
  createTestApp,
  createUser,
  expectNoMail,
  login,
  PASSWORD,
  refreshCookieOf,
  resetDb,
  TestContext,
  tokenFromMail,
  userSession,
  waitForMail,
} from './utils';

const NEW_PASSWORD = 'NuevaClave456';

describe('Recuperación y cambio de contraseña (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const forgot = (email: string) =>
    ctx.http().post('/auth/forgot-password').send({ email });
  const reset = (token: string, password = NEW_PASSWORD) =>
    ctx.http().post('/auth/reset-password').send({ token, password });

  async function resetToken(email: string) {
    await forgot(email).expect(202);
    return tokenFromMail(
      await waitForMail(ctx, email, 'Restablece tu contraseña'),
    );
  }

  describe('recuperación', () => {
    it('responde igual exista o no la cuenta, y solo envía correo si existe', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const known = await forgot('ana@example.com').expect(202);
      const unknown = await forgot('nadie@example.com').expect(202);

      expect(unknown.body).toEqual(known.body);
      await waitForMail(ctx, 'ana@example.com', 'Restablece tu contraseña');
      await expectNoMail(ctx, 'nadie@example.com');
    });

    it('el enlace vence en 1 hora', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      await resetToken('ana@example.com');
      const [stored] = await ctx.db.getRepository(OneTimeToken).find();
      const minutes =
        (stored.expiresAt.getTime() - stored.createdAt.getTime()) / 60_000;
      expect(minutes).toBeCloseTo(60, 0);
    });

    it('restablece la contraseña, invalida el enlace y revoca todas las sesiones', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const session = await login(ctx, 'ana@example.com');
      const token = await resetToken('ana@example.com');

      await reset(token).expect(200);

      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', session.cookie)
        .expect(401);
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: PASSWORD })
        .expect(401);
      await login(ctx, 'ana@example.com', NEW_PASSWORD);

      const reused = await reset(token, 'OtraClave789').expect(400);
      expect(reused.body.code).toBe('INVALID_TOKEN');
    });

    it('rechaza enlaces expirados o inexistentes sin cambiar la contraseña', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const token = await resetToken('ana@example.com');
      await ctx.db.query(
        `UPDATE one_time_tokens SET expires_at = now() - interval '1 second'`,
      );

      await reset(token).expect(400);
      await reset('no-existe').expect(400);
      await login(ctx, 'ana@example.com', PASSWORD);
    });

    it('aplica la política de contraseñas', async () => {
      await createUser(ctx, { email: 'ana@example.com' });
      const token = await resetToken('ana@example.com');
      await reset(token, 'corta1').expect(400);
    });

    it('una cuenta creada solo con Google queda con contraseña y puede usar ambos métodos', async () => {
      await createUser(ctx, { email: 'g@example.com', password: null });
      const token = await resetToken('g@example.com');
      await reset(token).expect(200);

      const session = await login(ctx, 'g@example.com', NEW_PASSWORD);
      const me = await ctx
        .http()
        .get('/users/me')
        .set(session.auth)
        .expect(200);
      expect(me.body.providers).toContain('password');
    });

    it('restablecer también marca el correo como verificado (el enlace llegó a ese correo)', async () => {
      await createUser(ctx, { email: 'ana@example.com', verified: false });
      const token = await resetToken('ana@example.com');
      await reset(token).expect(200);
      await login(ctx, 'ana@example.com', NEW_PASSWORD);
    });
  });

  describe('cambio autenticado', () => {
    it('cambia la contraseña y revoca las demás sesiones, manteniendo la actual', async () => {
      const current = await userSession(ctx, { email: 'ana@example.com' });
      const other = await login(ctx, 'ana@example.com');

      await ctx
        .http()
        .post('/auth/change-password')
        .set(current.auth)
        .set('Cookie', current.cookie)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', other.cookie)
        .expect(401);
      const renewed = await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', current.cookie)
        .expect(200);
      expect(refreshCookieOf(renewed)).toBeDefined();
      await login(ctx, 'ana@example.com', NEW_PASSWORD);
    });

    it('rechaza el cambio si la contraseña actual no coincide', async () => {
      const session = await userSession(ctx, { email: 'ana@example.com' });
      const res = await ctx
        .http()
        .post('/auth/change-password')
        .set(session.auth)
        .send({ currentPassword: 'Incorrecta1', newPassword: NEW_PASSWORD })
        .expect(400);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${session.refreshToken}`)
        .expect(200);
      await login(ctx, 'ana@example.com', PASSWORD);
    });

    it('exige estar autenticado', async () => {
      await ctx
        .http()
        .post('/auth/change-password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(401);
    });
  });
});
