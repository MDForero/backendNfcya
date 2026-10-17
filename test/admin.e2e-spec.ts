import { AuditAction, AuditLog } from '../src/audit/audit-log.entity';
import { Organization } from '../src/organizations/organization.entity';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createOrganization,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestContext,
  userSession,
  waitForMail,
} from './utils';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Administración de usuarios y organizaciones (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  const users = () => ctx.db.getRepository(User);
  const audits = () => ctx.db.getRepository(AuditLog);

  describe('/admin/organizations', () => {
    it('SUPER_ADMIN crea y renombra organizaciones', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const created = await ctx
        .http()
        .post('/admin/organizations')
        .set(admin.auth)
        .send({ name: 'Acme' })
        .expect(201);
      expect(created.body).toMatchObject({
        id: expect.any(String),
        name: 'Acme',
      });

      await ctx
        .http()
        .patch(`/admin/organizations/${created.body.id}`)
        .set(admin.auth)
        .send({ name: 'Acme SAS' })
        .expect(200);
      expect(
        (
          await ctx.db
            .getRepository(Organization)
            .findOneByOrFail({ id: created.body.id })
        ).name,
      ).toBe('Acme SAS');
    });

    it('SUPER_ADMIN y SOPORTE listan organizaciones con paginación', async () => {
      await createOrganization(ctx, 'B');
      await createOrganization(ctx, 'A');
      for (const role of [Role.SUPER_ADMIN, Role.SOPORTE]) {
        const session = await userSession(ctx, { role });
        const res = await ctx
          .http()
          .get('/admin/organizations?pageSize=1')
          .set(session.auth)
          .expect(200);
        expect(res.body).toMatchObject({
          total: 2,
          page: 1,
          pageSize: 1,
          items: [{ name: 'A' }],
        });
      }
    });

    it('SOPORTE, EMPRESA y CLIENTE no pueden crear ni editar organizaciones', async () => {
      const org = await createOrganization(ctx);
      const sessions = [
        await userSession(ctx, { role: Role.SOPORTE }),
        await userSession(ctx, { role: Role.EMPRESA, organizationId: org.id }),
        await userSession(ctx, { role: Role.CLIENTE }),
      ];
      for (const s of sessions) {
        await ctx
          .http()
          .post('/admin/organizations')
          .set(s.auth)
          .send({ name: 'X' })
          .expect(403);
        await ctx
          .http()
          .patch(`/admin/organizations/${org.id}`)
          .set(s.auth)
          .send({ name: 'X' })
          .expect(403);
      }
    });
  });

  describe('listado y consulta', () => {
    it('SUPER_ADMIN ve usuarios de todas las organizaciones y sin organización, con filtros', async () => {
      const orgA = await createOrganization(ctx);
      const orgB = await createOrganization(ctx);
      const admin = await userSession(ctx, {
        role: Role.SUPER_ADMIN,
        email: 'admin@example.com',
      });
      await createUser(ctx, {
        organizationId: orgA.id,
        email: 'a@example.com',
      });
      await createUser(ctx, {
        organizationId: orgB.id,
        email: 'b@example.com',
      });
      await createUser(ctx, {
        email: 'libre@example.com',
        status: UserStatus.SUSPENDIDA,
      });

      const all = await ctx
        .http()
        .get('/admin/users')
        .set(admin.auth)
        .expect(200);
      expect(all.body.total).toBe(4);

      const byOrg = await ctx
        .http()
        .get(`/admin/users?organizationId=${orgB.id}`)
        .set(admin.auth)
        .expect(200);
      expect(byOrg.body.items.map((u: User) => u.email)).toEqual([
        'b@example.com',
      ]);

      const byStatus = await ctx
        .http()
        .get('/admin/users?status=SUSPENDIDA')
        .set(admin.auth)
        .expect(200);
      expect(byStatus.body.items.map((u: User) => u.email)).toEqual([
        'libre@example.com',
      ]);

      const byRole = await ctx
        .http()
        .get('/admin/users?role=SUPER_ADMIN')
        .set(admin.auth)
        .expect(200);
      expect(byRole.body.items.map((u: User) => u.email)).toEqual([
        'admin@example.com',
      ]);

      const search = await ctx
        .http()
        .get('/admin/users?search=LIBRE')
        .set(admin.auth)
        .expect(200);
      expect(search.body.total).toBe(1);

      const paged = await ctx
        .http()
        .get('/admin/users?page=2&pageSize=3')
        .set(admin.auth)
        .expect(200);
      expect(paged.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
      expect(paged.body.items).toHaveLength(1);
    });

    it('rechaza filtros inválidos', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .get('/admin/users?role=DIOS')
        .set(admin.auth)
        .expect(400);
      await ctx
        .http()
        .get('/admin/users?pageSize=500')
        .set(admin.auth)
        .expect(400);
    });

    it('SOPORTE consulta cualquier usuario sin datos secretos', async () => {
      const soporte = await userSession(ctx, { role: Role.SOPORTE });
      const target = await createUser(ctx);
      const res = await ctx
        .http()
        .get(`/admin/users/${target.id}`)
        .set(soporte.auth)
        .expect(200);
      expect(res.body).toMatchObject({ id: target.id, email: target.email });
      expect(JSON.stringify(res.body)).not.toMatch(/hash|argon2/i);
    });

    it('EMPRESA lista únicamente los CLIENTE de su organización (ignora filtros que lo amplíen)', async () => {
      const orgA = await createOrganization(ctx);
      const orgB = await createOrganization(ctx);
      const empresa = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });
      await createUser(ctx, {
        email: 'mio@example.com',
        organizationId: orgA.id,
      });
      await createUser(ctx, {
        email: 'ajeno@example.com',
        organizationId: orgB.id,
      });
      await createUser(ctx, {
        email: 'colega@example.com',
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });
      await createUser(ctx, { email: 'suelto@example.com' });

      for (const query of ['', `?organizationId=${orgB.id}`, '?role=EMPRESA']) {
        const res = await ctx
          .http()
          .get(`/admin/users${query}`)
          .set(empresa.auth)
          .expect(200);
        expect(res.body.items.map((u: User) => u.email)).toEqual([
          'mio@example.com',
        ]);
      }
    });

    it('EMPRESA recibe 404 al consultar usuarios fuera de su alcance', async () => {
      const orgA = await createOrganization(ctx);
      const orgB = await createOrganization(ctx);
      const empresa = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });
      const ajeno = await createUser(ctx, { organizationId: orgB.id });
      const mio = await createUser(ctx, { organizationId: orgA.id });

      await ctx
        .http()
        .get(`/admin/users/${ajeno.id}`)
        .set(empresa.auth)
        .expect(404);
      await ctx
        .http()
        .get(`/admin/users/${MISSING_ID}`)
        .set(empresa.auth)
        .expect(404);
      await ctx
        .http()
        .get(`/admin/users/${mio.id}`)
        .set(empresa.auth)
        .expect(200);
    });
  });

  describe('cambio de rol y organización', () => {
    it('SUPER_ADMIN cambia un rol y queda auditado', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const target = await createUser(ctx);

      const res = await ctx
        .http()
        .patch(`/admin/users/${target.id}/role`)
        .set(admin.auth)
        .send({ role: Role.SOPORTE })
        .expect(200);
      expect(res.body.role).toBe(Role.SOPORTE);

      const [log] = await audits().find();
      expect(log).toMatchObject({
        actorId: admin.user.id,
        targetUserId: target.id,
        action: AuditAction.ROLE_CHANGED,
        before: { role: Role.CLIENTE },
        after: { role: Role.SOPORTE },
      });
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it('rechaza un rol fuera del catálogo', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const target = await createUser(ctx);
      await ctx
        .http()
        .patch(`/admin/users/${target.id}/role`)
        .set(admin.auth)
        .send({ role: 'DIOS' })
        .expect(400);
    });

    it('asignar EMPRESA exige que el usuario tenga organización', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const target = await createUser(ctx);
      const res = await ctx
        .http()
        .patch(`/admin/users/${target.id}/role`)
        .set(admin.auth)
        .send({ role: Role.EMPRESA })
        .expect(400);
      expect(res.body.message).toContain('organización');

      const org = await createOrganization(ctx);
      await ctx
        .http()
        .patch(`/admin/users/${target.id}/organization`)
        .set(admin.auth)
        .send({ organizationId: org.id })
        .expect(200);
      await ctx
        .http()
        .patch(`/admin/users/${target.id}/role`)
        .set(admin.auth)
        .send({ role: Role.EMPRESA })
        .expect(200);
    });

    it('un SUPER_ADMIN no puede cambiar su propio rol', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      await createUser(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .patch(`/admin/users/${admin.user.id}/role`)
        .set(admin.auth)
        .send({ role: Role.CLIENTE })
        .expect(400);
    });

    it('con dos SUPER_ADMIN activos se puede degradar a uno', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const other = await createUser(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .patch(`/admin/users/${other.id}/role`)
        .set(admin.auth)
        .send({ role: Role.CLIENTE })
        .expect(200);
    });

    it('un SUPER_ADMIN suspendido no cuenta como activo y se puede degradar', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const suspended = await createUser(ctx, {
        role: Role.SUPER_ADMIN,
        status: UserStatus.SUSPENDIDA,
      });
      await ctx
        .http()
        .patch(`/admin/users/${suspended.id}/role`)
        .set(admin.auth)
        .send({ role: Role.CLIENTE })
        .expect(200);
    });

    it.each([
      [
        'suspensiones',
        (id: string) => ({
          method: 'post' as const,
          url: `/admin/users/${id}/suspend`,
          body: {},
        }),
      ],
      [
        'degradaciones',
        (id: string) => ({
          method: 'patch' as const,
          url: `/admin/users/${id}/role`,
          body: { role: Role.CLIENTE },
        }),
      ],
    ])(
      'dos %s cruzadas simultáneas no dejan la plataforma sin SUPER_ADMIN activo',
      async (_case, op) => {
        const a = await userSession(ctx, { role: Role.SUPER_ADMIN });
        const b = await userSession(ctx, { role: Role.SUPER_ADMIN });

        const send = (actor: typeof a, targetId: string) => {
          const { method, url, body } = op(targetId);
          return ctx.http()[method](url).set(actor.auth).send(body);
        };
        const results = await Promise.all([
          send(a, b.user.id),
          send(b, a.user.id),
        ]);

        // Una gana; la otra la rechaza la regla (409) o el guard, si su actor ya perdió el acceso (401/403).
        const statuses = results.map((r) => r.status).sort();
        expect(statuses[0]).toBe(200);
        expect([401, 403, 409]).toContain(statuses[1]);

        const [{ n }] = await ctx.db.query(
          `SELECT count(*)::int AS n FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVA'`,
        );
        expect(n).toBe(1);
      },
    );

    it('cambiar la organización valida que exista y se audita; null la quita', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const org = await createOrganization(ctx);
      const target = await createUser(ctx);

      await ctx
        .http()
        .patch(`/admin/users/${target.id}/organization`)
        .set(admin.auth)
        .send({ organizationId: MISSING_ID })
        .expect(404);
      await ctx
        .http()
        .patch(`/admin/users/${target.id}/organization`)
        .set(admin.auth)
        .send({ organizationId: org.id })
        .expect(200);
      const cleared = await ctx
        .http()
        .patch(`/admin/users/${target.id}/organization`)
        .set(admin.auth)
        .send({ organizationId: null })
        .expect(200);
      expect(cleared.body.organization).toBeNull();

      const logs = await audits().find({ order: { createdAt: 'ASC' } });
      expect(logs.map((l) => [l.action, l.after])).toEqual([
        [AuditAction.ORGANIZATION_CHANGED, { organizationId: org.id }],
        [AuditAction.ORGANIZATION_CHANGED, { organizationId: null }],
      ]);
    });

    it('no se puede quitar la organización a un EMPRESA', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const org = await createOrganization(ctx);
      const empresa = await createUser(ctx, {
        role: Role.EMPRESA,
        organizationId: org.id,
      });
      await ctx
        .http()
        .patch(`/admin/users/${empresa.id}/organization`)
        .set(admin.auth)
        .send({ organizationId: null })
        .expect(400);
    });

    it.each([Role.SOPORTE, Role.EMPRESA])(
      '%s no puede cambiar roles ni organizaciones',
      async (role) => {
        const org = await createOrganization(ctx);
        const session = await userSession(ctx, {
          role,
          organizationId: org.id,
        });
        const target = await createUser(ctx, { organizationId: org.id });
        await ctx
          .http()
          .patch(`/admin/users/${target.id}/role`)
          .set(session.auth)
          .send({ role: Role.SOPORTE })
          .expect(403);
        await ctx
          .http()
          .patch(`/admin/users/${target.id}/organization`)
          .set(session.auth)
          .send({ organizationId: null })
          .expect(403);
        expect((await users().findOneByOrFail({ id: target.id })).role).toBe(
          Role.CLIENTE,
        );
      },
    );
  });

  describe('suspensión y reactivación', () => {
    it('SUPER_ADMIN suspende: revoca sesiones, bloquea el acceso y audita; reactivar lo devuelve', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const target = await userSession(ctx, { email: 'ana@example.com' });

      const res = await ctx
        .http()
        .post(`/admin/users/${target.user.id}/suspend`)
        .set(admin.auth)
        .expect(200);
      expect(res.body.status).toBe(UserStatus.SUSPENDIDA);
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', target.cookie)
        .expect(401);
      await ctx.http().get('/users/me').set(target.auth).expect(401);
      await ctx
        .http()
        .post('/auth/login')
        .send({ email: 'ana@example.com', password: 'Secreta123' })
        .expect(403);

      await ctx
        .http()
        .post(`/admin/users/${target.user.id}/reactivate`)
        .set(admin.auth)
        .expect(200);
      await login(ctx, 'ana@example.com');

      const actions = (
        await audits().find({ order: { createdAt: 'ASC' } })
      ).map((l) => l.action);
      expect(actions).toEqual([
        AuditAction.USER_SUSPENDED,
        AuditAction.USER_REACTIVATED,
      ]);
    });

    it('nadie puede suspenderse a sí mismo', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      await createUser(ctx, { role: Role.SUPER_ADMIN });
      await ctx
        .http()
        .post(`/admin/users/${admin.user.id}/suspend`)
        .set(admin.auth)
        .expect(400);
    });

    it('suspender de nuevo una cuenta suspendida no genera otra auditoría', async () => {
      const admin = await userSession(ctx, { role: Role.SUPER_ADMIN });
      const target = await createUser(ctx);
      await ctx
        .http()
        .post(`/admin/users/${target.id}/suspend`)
        .set(admin.auth)
        .expect(200);
      await ctx
        .http()
        .post(`/admin/users/${target.id}/suspend`)
        .set(admin.auth)
        .expect(200);
      expect(await audits().count()).toBe(1);
    });

    it('EMPRESA suspende y reactiva CLIENTE de su organización, pero no de otras', async () => {
      const orgA = await createOrganization(ctx);
      const orgB = await createOrganization(ctx);
      const empresa = await userSession(ctx, {
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });
      const mio = await userSession(ctx, { organizationId: orgA.id });
      const ajeno = await createUser(ctx, { organizationId: orgB.id });
      const colega = await createUser(ctx, {
        role: Role.EMPRESA,
        organizationId: orgA.id,
      });

      await ctx
        .http()
        .post(`/admin/users/${mio.user.id}/suspend`)
        .set(empresa.auth)
        .expect(200);
      await ctx
        .http()
        .post('/auth/refresh')
        .set('Cookie', mio.cookie)
        .expect(401);
      await ctx
        .http()
        .post(`/admin/users/${mio.user.id}/reactivate`)
        .set(empresa.auth)
        .expect(200);

      await ctx
        .http()
        .post(`/admin/users/${ajeno.id}/suspend`)
        .set(empresa.auth)
        .expect(404);
      await ctx
        .http()
        .post(`/admin/users/${colega.id}/suspend`)
        .set(empresa.auth)
        .expect(404);
      expect((await users().findOneByOrFail({ id: ajeno.id })).status).toBe(
        UserStatus.ACTIVA,
      );
    });

    it('SOPORTE no puede suspender ni reactivar', async () => {
      const soporte = await userSession(ctx, { role: Role.SOPORTE });
      const target = await createUser(ctx);
      await ctx
        .http()
        .post(`/admin/users/${target.id}/suspend`)
        .set(soporte.auth)
        .expect(403);
      await ctx
        .http()
        .post(`/admin/users/${target.id}/reactivate`)
        .set(soporte.auth)
        .expect(403);
      expect((await users().findOneByOrFail({ id: target.id })).status).toBe(
        UserStatus.ACTIVA,
      );
    });
  });

  describe('acciones de asistencia', () => {
    it.each([Role.SUPER_ADMIN, Role.SOPORTE])(
      '%s reenvía la verificación y envía recuperación',
      async (role) => {
        const session = await userSession(ctx, { role });
        const target = await createUser(ctx, {
          email: 'ana@example.com',
          verified: false,
        });

        await ctx
          .http()
          .post(`/admin/users/${target.id}/resend-verification`)
          .set(session.auth)
          .expect(202);
        await waitForMail(ctx, 'ana@example.com', 'Confirma tu correo');

        await ctx
          .http()
          .post(`/admin/users/${target.id}/send-password-reset`)
          .set(session.auth)
          .expect(202);
        await waitForMail(ctx, 'ana@example.com', 'Restablece tu contraseña');
      },
    );

    it('reenviar la verificación a un correo ya verificado responde 409', async () => {
      const soporte = await userSession(ctx, { role: Role.SOPORTE });
      const target = await createUser(ctx);
      await ctx
        .http()
        .post(`/admin/users/${target.id}/resend-verification`)
        .set(soporte.auth)
        .expect(409);
    });

    it('EMPRESA y CLIENTE no pueden usar las acciones de asistencia', async () => {
      const org = await createOrganization(ctx);
      const target = await createUser(ctx, {
        organizationId: org.id,
        verified: false,
      });
      for (const role of [Role.EMPRESA, Role.CLIENTE]) {
        const session = await userSession(ctx, {
          role,
          organizationId: org.id,
        });
        await ctx
          .http()
          .post(`/admin/users/${target.id}/resend-verification`)
          .set(session.auth)
          .expect(403);
        await ctx
          .http()
          .post(`/admin/users/${target.id}/send-password-reset`)
          .set(session.auth)
          .expect(403);
      }
    });

    it('responde 404 para usuarios inexistentes y 400 para ids mal formados', async () => {
      const soporte = await userSession(ctx, { role: Role.SOPORTE });
      await ctx
        .http()
        .post(`/admin/users/${MISSING_ID}/send-password-reset`)
        .set(soporte.auth)
        .expect(404);
      await ctx
        .http()
        .get('/admin/users/no-es-uuid')
        .set(soporte.auth)
        .expect(400);
    });
  });
});
