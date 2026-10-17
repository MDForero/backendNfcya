import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { hashPassword } from '../src/auth/crypto.util';
import { REFRESH_COOKIE } from '../src/auth/refresh-cookie.service';
import {
  LogMailTransport,
  MAIL_TRANSPORT,
  MailMessage,
} from '../src/mail/mail.transport';
import { Organization } from '../src/organizations/organization.entity';
import { Role, UserStatus } from '../src/users/role.enum';
import { User } from '../src/users/user.entity';

export const PASSWORD = 'Secreta123';

export interface TestContext {
  app: INestApplication<App>;
  http: () => ReturnType<typeof request>;
  db: DataSource;
  outbox: LogMailTransport['outbox'];
}

export async function createTestApp(
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestContext> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (customize) builder = customize(builder);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  setupApp(app);
  await app.init();

  return {
    app,
    http: () => request(app.getHttpServer()),
    db: app.get(DataSource),
    outbox: app.get<LogMailTransport>(MAIL_TRANSPORT).outbox,
  };
}

/** Vacía todas las tablas de datos (no la de migraciones) y el buzón en memoria. */
export async function resetDb(ctx: TestContext) {
  const tables = ctx.db.entityMetadatas
    .map((m) => `"${m.tableName}"`)
    .join(', ');
  await ctx.db.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  ctx.outbox.length = 0;
}

/** Espera a que llegue un correo (se envían en segundo plano). */
export async function waitForMail(
  ctx: TestContext,
  to: string,
  subjectIncludes: string,
  timeoutMs = 3000,
): Promise<MailMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = ctx.outbox.find(
      (m) => m.to === to && m.subject.includes(subjectIncludes),
    );
    if (found) return found;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`No llegó el correo "${subjectIncludes}" a ${to}`);
}

/** Espera un poco y comprueba que NO llegó ningún correo a ese destinatario. */
export async function expectNoMail(ctx: TestContext, to: string, waitMs = 300) {
  await new Promise((r) => setTimeout(r, waitMs));
  expect(ctx.outbox.filter((m) => m.to === to)).toEqual([]);
}

export function tokenFromMail(mail: MailMessage) {
  const match = /token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error('El correo no trae token');
  return match[1];
}

export interface SeedUser {
  email?: string;
  name?: string;
  role?: Role;
  status?: UserStatus;
  verified?: boolean;
  password?: string | null;
  organizationId?: string | null;
}

let seq = 0;
export async function createUser(ctx: TestContext, data: SeedUser = {}) {
  seq += 1;
  const repo = ctx.db.getRepository(User);
  const password = data.password === undefined ? PASSWORD : data.password;
  return repo.save(
    repo.create({
      email: data.email ?? `user${seq}@example.com`,
      name: data.name ?? `Usuario ${seq}`,
      role: data.role ?? Role.CLIENTE,
      status: data.status ?? UserStatus.ACTIVA,
      emailVerifiedAt: data.verified === false ? null : new Date(),
      passwordHash: password ? await hashPassword(password) : null,
      organizationId: data.organizationId ?? null,
    }),
  );
}

export function createOrganization(ctx: TestContext, name = `Org ${++seq}`) {
  const repo = ctx.db.getRepository(Organization);
  return repo.save(repo.create({ name }));
}

/** Valor de la cookie de refresh en una respuesta, o undefined. */
export function refreshCookieOf(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  const value = cookie?.split(';')[0].slice(REFRESH_COOKIE.length + 1);
  return value || undefined;
}

export function rawSetCookie(res: request.Response, name: string) {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

export interface LoggedIn {
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
  cookie: string;
}

export async function login(
  ctx: TestContext,
  email: string,
  password = PASSWORD,
): Promise<LoggedIn> {
  const res = await ctx
    .http()
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  const body = res.body as { accessToken: string };
  const refreshToken = refreshCookieOf(res)!;
  return {
    accessToken: body.accessToken,
    refreshToken,
    auth: { Authorization: `Bearer ${body.accessToken}` },
    cookie: `${REFRESH_COOKIE}=${refreshToken}`,
  };
}

/** Crea un usuario y abre sesión con él. */
export async function userSession(ctx: TestContext, data: SeedUser = {}) {
  const user = await createUser(ctx, data);
  return { user, ...(await login(ctx, user.email)) };
}
