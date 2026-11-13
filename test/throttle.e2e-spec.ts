import type { TestContext } from './utils';

describe('Throttling por IP en /auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // ConfigModule se evalúa al importar AppModule: los límites se fijan antes de cargarlo.
    process.env.AUTH_THROTTLE_LIMIT = '3';
    process.env.AUTH_SESSION_THROTTLE_LIMIT = '6';
    process.env.TRUST_PROXY = '1';

    const utils = require('./utils') as typeof import('./utils');
    ctx = await utils.createTestApp();
    await utils.resetDb(ctx);
  });

  afterAll(async () => {
    delete process.env.AUTH_THROTTLE_LIMIT;
    delete process.env.AUTH_SESSION_THROTTLE_LIMIT;
    delete process.env.TRUST_PROXY;
    await ctx.app.close();
  });

  it('responde 429 al superar el límite de peticiones por minuto', async () => {
    const forgot = () =>
      ctx.http().post('/auth/forgot-password').send({ email: 'x@example.com' });
    for (let i = 0; i < 3; i++) await forgot().expect(202);
    await forgot().expect(429);
  });

  it('/auth/refresh usa su propio límite, más alto que el de login/registro', async () => {
    const refresh = () =>
      ctx.http().post('/auth/refresh').set('X-Forwarded-For', '203.0.113.10');
    // Sin cookie responde 401, pero cuenta para el límite: pasa de 3 (AUTH_THROTTLE_LIMIT)…
    for (let i = 0; i < 6; i++) await refresh().expect(401);
    // …y solo se corta al superar AUTH_SESSION_THROTTLE_LIMIT.
    await refresh().expect(429);
  });

  it('con TRUST_PROXY cada IP real (X-Forwarded-For) tiene su propio contador', async () => {
    const forgot = (ip: string) =>
      ctx
        .http()
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', ip)
        .send({ email: 'x@example.com' });
    for (let i = 0; i < 3; i++) await forgot('198.51.100.1').expect(202);
    await forgot('198.51.100.1').expect(429);
    // Otro visitante detrás del mismo proxy no queda bloqueado.
    await forgot('198.51.100.2').expect(202);
  });

  it('no limita rutas fuera de /auth', async () => {
    for (let i = 0; i < 5; i++) await ctx.http().get('/users/me').expect(401);
  });
});
