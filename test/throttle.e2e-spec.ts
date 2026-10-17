import type { TestContext } from './utils';

describe('Throttling por IP en /auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // ConfigModule se evalúa al importar AppModule: el límite se fija antes de cargarlo.
    process.env.AUTH_THROTTLE_LIMIT = '3';

    const utils = require('./utils') as typeof import('./utils');
    ctx = await utils.createTestApp();
    await utils.resetDb(ctx);
  });

  afterAll(async () => {
    delete process.env.AUTH_THROTTLE_LIMIT;
    await ctx.app.close();
  });

  it('responde 429 al superar el límite de peticiones por minuto', async () => {
    const forgot = () =>
      ctx.http().post('/auth/forgot-password').send({ email: 'x@example.com' });
    for (let i = 0; i < 3; i++) await forgot().expect(202);
    await forgot().expect(429);
  });

  it('no limita rutas fuera de /auth', async () => {
    for (let i = 0; i < 5; i++) await ctx.http().get('/users/me').expect(401);
  });
});
