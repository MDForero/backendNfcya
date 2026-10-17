import { OneTimeToken } from '../src/auth/entities/one-time-token.entity';
import { Role } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createTestApp,
  createUser,
  expectNoMail,
  PASSWORD,
  resetDb,
  TestContext,
  tokenFromMail,
  waitForMail,
} from './utils';

describe('Registro y verificación de email (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const users = () => ctx.db.getRepository(User);
  const register = (body: Record<string, unknown>) =>
    ctx.http().post('/auth/register').send(body);

  describe('POST /auth/register', () => {
    it('crea un CLIENTE sin verificar, envía la verificación y no emite tokens', async () => {
      const res = await register({
        name: 'Ana',
        email: 'Ana@Example.com',
        password: PASSWORD,
      }).expect(202);

      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.headers['set-cookie']).toBeUndefined();

      const user = await users().findOneByOrFail({ email: 'ana@example.com' });
      expect(user.role).toBe(Role.CLIENTE);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.organizationId).toBeNull();

      await waitForMail(ctx, 'ana@example.com', 'Confirma tu correo');
    });

    it.each([
      ['menos de 8 caracteres', 'Abc123'],
      ['sin números', 'SoloLetras'],
      ['sin letras', '1234567890'],
    ])('rechaza una contraseña con %s', async (_case, password) => {
      const res = await register({
        name: 'Ana',
        email: 'ana@example.com',
        password,
      }).expect(400);
      expect(JSON.stringify(res.body)).toContain('contraseña');
      expect(await users().count()).toBe(0);
    });

    it('responde igual con un email ya registrado, no duplica y avisa al dueño', async () => {
      await createUser(ctx, { email: 'ana@example.com' });

      const fresh = await register({
        name: 'Otro',
        email: 'nuevo@example.com',
        password: PASSWORD,
      }).expect(202);
      const dup = await register({
        name: 'Otra',
        email: 'ANA@example.com',
        password: PASSWORD,
      }).expect(202);

      expect(dup.body).toEqual(fresh.body);
      expect(await users().countBy({ email: 'ana@example.com' })).toBe(1);
      await waitForMail(ctx, 'ana@example.com', 'Intento de registro');
    });

    it('descarta campos no declarados como role u organizationId (ValidationPipe whitelist)', async () => {
      await register({
        name: 'Eva',
        email: 'eva@example.com',
        password: PASSWORD,
        role: Role.SUPER_ADMIN,
        organizationId: '00000000-0000-0000-0000-000000000000',
      }).expect(202);

      const user = await users().findOneByOrFail({ email: 'eva@example.com' });
      expect(user.role).toBe(Role.CLIENTE);
      expect(user.organizationId).toBeNull();
    });
  });

  describe('verificación de email', () => {
    async function registerAndGetToken(email = 'ana@example.com') {
      await register({ name: 'Ana', email, password: PASSWORD }).expect(202);
      return tokenFromMail(await waitForMail(ctx, email, 'Confirma tu correo'));
    }

    it('un enlace vigente verifica el correo y queda invalidado', async () => {
      const token = await registerAndGetToken();

      await ctx.http().post('/auth/verify-email').send({ token }).expect(200);
      const user = await users().findOneByOrFail({ email: 'ana@example.com' });
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);

      const reused = await ctx
        .http()
        .post('/auth/verify-email')
        .send({ token })
        .expect(400);
      expect(reused.body.code).toBe('INVALID_TOKEN');
    });

    it('rechaza un enlace expirado', async () => {
      const token = await registerAndGetToken();
      await ctx.db.query(
        `UPDATE one_time_tokens SET expires_at = now() - interval '1 second'`,
      );

      const res = await ctx
        .http()
        .post('/auth/verify-email')
        .send({ token })
        .expect(400);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });

    it('el token vence a las 24 horas', async () => {
      await registerAndGetToken();
      const [stored] = await ctx.db.getRepository(OneTimeToken).find();
      const hours =
        (stored.expiresAt.getTime() - stored.createdAt.getTime()) / 3_600_000;
      expect(hours).toBeCloseTo(24, 1);
    });

    it('reenviar invalida los enlaces anteriores y envía uno nuevo', async () => {
      const first = await registerAndGetToken();
      ctx.outbox.length = 0;

      await ctx
        .http()
        .post('/auth/resend-verification')
        .send({ email: 'ana@example.com' })
        .expect(202);
      const second = tokenFromMail(
        await waitForMail(ctx, 'ana@example.com', 'Confirma tu correo'),
      );
      expect(second).not.toBe(first);

      await ctx
        .http()
        .post('/auth/verify-email')
        .send({ token: first })
        .expect(400);
      await ctx
        .http()
        .post('/auth/verify-email')
        .send({ token: second })
        .expect(200);
    });

    it('el reenvío responde igual para emails inexistentes o ya verificados y no envía nada', async () => {
      await createUser(ctx, { email: 'verificada@example.com' });

      const unknown = await ctx
        .http()
        .post('/auth/resend-verification')
        .send({ email: 'nadie@example.com' })
        .expect(202);
      const verified = await ctx
        .http()
        .post('/auth/resend-verification')
        .send({ email: 'verificada@example.com' })
        .expect(202);

      expect(verified.body).toEqual(unknown.body);
      await expectNoMail(ctx, 'nadie@example.com');
      await expectNoMail(ctx, 'verificada@example.com', 0);
    });
  });
});
