import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createOrganization,
  createTestApp,
  resetDb,
  TestContext,
  userSession,
} from './utils';

describe('Guards de autenticación y roles (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  describe('JwtAuthGuard', () => {
    it('sin token responde 401 en rutas protegidas', async () => {
      await ctx.http().get('/users/me').expect(401);
    });

    it('con un esquema distinto de Bearer responde 401', async () => {
      const { accessToken } = await userSession(ctx);
      await ctx
        .http()
        .get('/users/me')
        .set('Authorization', `Basic ${accessToken}`)
        .expect(401);
    });

    it('con un token alterado responde 401', async () => {
      const { accessToken } = await userSession(ctx);
      const [header, payload, signature] = accessToken.split('.');
      const forged = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as Record<string, unknown>;
      forged.role = Role.SUPER_ADMIN;
      const tampered = [
        header,
        Buffer.from(JSON.stringify(forged)).toString('base64url'),
        signature,
      ].join('.');
      await ctx
        .http()
        .get('/users/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });

    it('con un token expirado responde 401', async () => {
      const { user } = await userSession(ctx);
      const expired = await ctx.app
        .get(JwtService)
        .signAsync({ sub: user.id, role: user.role }, { expiresIn: -10 });
      await ctx
        .http()
        .get('/users/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('una cuenta suspendida recibe 401 aunque su access token no haya expirado', async () => {
      const session = await userSession(ctx);
      await ctx.http().get('/users/me').set(session.auth).expect(200);
      await ctx.db
        .getRepository(User)
        .update({ id: session.user.id }, { status: UserStatus.SUSPENDIDA });
      await ctx.http().get('/users/me').set(session.auth).expect(401);
    });

    it('las rutas públicas aceptan peticiones sin sesión', async () => {
      await ctx
        .http()
        .post('/auth/forgot-password')
        .send({ email: 'x@example.com' })
        .expect(202);
    });
  });

  describe('RolesGuard', () => {
    it('un SUPER_ADMIN accede a una ruta restringida a SUPER_ADMIN', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .post('/admin/organizations')
        .set(admin.auth)
        .send({ name: 'Acme' })
        .expect(201);
    });

    it.each([Role.SOPORTE, Role.CLIENTE])(
      'un %s recibe 403 en una ruta solo para SUPER_ADMIN',
      async (role) => {
        const session = await userSession(ctx, { role });
        await ctx
          .http()
          .post('/admin/organizations')
          .set(session.auth)
          .send({ name: 'Acme' })
          .expect(403);
      },
    );

    it('un CLIENTE recibe 403 en rutas de SUPER_ADMIN o SOPORTE', async () => {
      const cliente = await userSession(ctx);
      await ctx
        .http()
        .get('/admin/organizations')
        .set(cliente.auth)
        .expect(403);
      await ctx.http().get('/admin/users').set(cliente.auth).expect(403);
    });

    it('sin @Roles basta con estar autenticado (cualquier rol)', async () => {
      for (const role of [Role.SUPER_ADMIN, Role.SOPORTE, Role.CLIENTE]) {
        const session = await userSession(ctx, { role });
        await ctx.http().get('/users/me').set(session.auth).expect(200);
      }
    });

    it('usa el rol vigente: un EMPRESA degradado a CLIENTE pierde acceso con su token anterior', async () => {
      const org = await createOrganization(ctx);
      const empresa = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: org.id,
      });
      await ctx.http().get('/admin/users').set(empresa.auth).expect(200);

      await ctx.db
        .getRepository(User)
        .update({ id: empresa.user.id }, { role: Role.CLIENTE });
      await ctx.http().get('/admin/users').set(empresa.auth).expect(403);
    });
  });
});
