import { LoginAttempt } from '../src/auth/entities/login-attempt.entity';
import {
  OneTimeToken,
  OneTimeTokenType,
} from '../src/auth/entities/one-time-token.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { MaintenanceService } from '../src/auth/maintenance.service';
import { BootstrapAdminService } from '../src/users/bootstrap-admin.service';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';
import {
  createTestApp,
  createUser,
  login,
  PASSWORD,
  resetDb,
  TestContext,
} from './utils';

describe('Bootstrap del SUPER_ADMIN y mantenimiento (integración)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx));
  afterAll(() => ctx.app.close());

  describe('BootstrapAdminService', () => {
    const run = (input: Parameters<BootstrapAdminService['run']>[0]) =>
      ctx.app.get(BootstrapAdminService).run(input);

    it('sin SUPER_ADMIN crea uno activo, verificado y con contraseña hasheada', async () => {
      await expect(
        run({ email: 'Root@NFCya.com', password: 'Admin12345', name: 'Root' }),
      ).resolves.toBe('created');

      const admin = await ctx.db
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where({ email: 'root@nfcya.com' })
        .getOneOrFail();
      expect(admin).toMatchObject({
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVA,
        organizationId: null,
      });
      expect(admin.emailVerifiedAt).toBeInstanceOf(Date);
      expect(admin.passwordHash).toMatch(/^\$argon2id\$/);

      await login(ctx, 'root@nfcya.com', 'Admin12345');
    });

    it('si ya existe un SUPER_ADMIN no crea ni modifica nada', async () => {
      const existing = await createUser(ctx, {
        role: Role.SUPER_ADMIN,
        email: 'jefe@example.com',
      });
      await expect(
        run({ email: 'otro@nfcya.com', password: 'Admin12345' }),
      ).resolves.toBe('skipped');

      expect(await ctx.db.getRepository(User).count()).toBe(1);
      await login(ctx, existing.email, PASSWORD);
    });

    it('exige email y contraseña válidos', async () => {
      await expect(run({})).rejects.toThrow('BOOTSTRAP_ADMIN_');
      await expect(
        run({ email: 'root@nfcya.com', password: 'corta' }),
      ).rejects.toThrow('contraseña');
    });

    it('no convierte en administrador a un usuario existente con ese email', async () => {
      await createUser(ctx, { email: 'root@nfcya.com' });
      await expect(
        run({ email: 'root@nfcya.com', password: 'Admin12345' }),
      ).rejects.toThrow('Ya existe');
      expect(
        (
          await ctx.db
            .getRepository(User)
            .findOneByOrFail({ email: 'root@nfcya.com' })
        ).role,
      ).toBe(Role.CLIENTE);
    });
  });

  describe('MaintenanceService.purge', () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

    it('borra solo los registros vencidos, revocados o usados hace más de 30 días', async () => {
      const user = await createUser(ctx);
      const attempts = ctx.db.getRepository(LoginAttempt);
      const refresh = ctx.db.getRepository(RefreshToken);
      const oneTime = ctx.db.getRepository(OneTimeToken);

      await attempts.insert([
        {
          email: 'viejo@example.com',
          ip: null,
          succeeded: false,
          createdAt: daysAgo(31),
        },
        {
          email: 'nuevo@example.com',
          ip: null,
          succeeded: false,
          createdAt: daysAgo(29),
        },
      ]);

      let n = 0;
      const rt = (expiresAt: Date, revokedAt: Date | null) =>
        refresh.create({
          userId: user.id,
          familyId: '11111111-1111-4111-8111-111111111111',
          tokenHash: `rt-${++n}`.padEnd(64, '0'),
          expiresAt,
          revokedAt,
          replacedById: null,
          ip: null,
          userAgent: null,
        });
      await refresh.save([
        rt(daysAgo(31), null), // vencido hace mucho → se borra
        rt(daysAgo(-10), daysAgo(31)), // revocado hace mucho → se borra
        rt(daysAgo(-10), daysAgo(5)), // revocado hace poco → se conserva
        rt(daysAgo(-10), null), // vigente → se conserva
      ]);

      const ott = (expiresAt: Date, usedAt: Date | null) =>
        oneTime.create({
          userId: user.id,
          type: OneTimeTokenType.VERIFY_EMAIL,
          tokenHash: `ot-${++n}`.padEnd(64, '0'),
          expiresAt,
          usedAt,
        });
      await oneTime.save([
        ott(daysAgo(31), null), // vencido hace mucho → se borra
        ott(daysAgo(-1), daysAgo(40)), // usado hace mucho → se borra
        ott(daysAgo(2), null), // vencido hace poco → se conserva
      ]);

      const result = await ctx.app.get(MaintenanceService).purge();

      expect(result).toEqual({
        loginAttempts: 1,
        refreshTokens: 2,
        oneTimeTokens: 2,
      });
      expect((await attempts.find()).map((a) => a.email)).toEqual([
        'nuevo@example.com',
      ]);
      expect(await refresh.count()).toBe(2);
      expect(await oneTime.count()).toBe(1);
    });
  });
});
