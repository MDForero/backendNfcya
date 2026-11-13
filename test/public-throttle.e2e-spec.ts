import { Role } from '../src/users/role.enum';
import { createTestApp, resetDb, TestContext, userSession } from './utils';

/** App propia: los contadores del throttler viven en memoria y no deben arrastrar otras suites. */
describe('Rate limit en rutas públicas de perfiles (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx);
  });

  afterAll(async () => {
    process.env.PUBLIC_THROTTLE_LIMIT = '1000';
    process.env.LEADS_THROTTLE_LIMIT = '1000';
    await ctx.app.close();
  });

  it('limita la resolución de códigos NFC/QR', async () => {
    process.env.PUBLIC_THROTTLE_LIMIT = '3';
    const resolve = () => ctx.http().get('/resolve/AAAAAAAAAAAAAAAA');
    for (let i = 0; i < 3; i++) await resolve().expect(404);
    await resolve().expect(429);
  });

  it('limita la captura de leads', async () => {
    process.env.LEADS_THROTTLE_LIMIT = '2';
    const owner = await userSession(ctx, { role: Role.CLIENTE });
    await ctx
      .http()
      .post('/profiles')
      .set(owner.auth)
      .send({ slug: 'ana', displayName: 'Ana', leadsEnabled: true })
      .expect(201);
    await ctx.http().post('/profiles/me/publish').set(owner.auth).expect(200);

    const send = () =>
      ctx
        .http()
        .post('/profiles/public/ana/leads')
        .send({ name: 'X', email: 'x@example.com', consentAccepted: true });
    await send().expect(201);
    await send().expect(201);
    await send().expect(429);
  });
});
