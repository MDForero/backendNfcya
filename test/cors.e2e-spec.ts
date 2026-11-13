import { createTestApp, TestContext } from './utils';

/** FRONTEND_URL de .env.test: http://localhost:3000 */
describe('CORS con credenciales (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());

  it('el origen del frontend recibe CORS con credenciales en el preflight', async () => {
    const res = await ctx
      .http()
      .options('/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('otros orígenes no quedan autorizados (el navegador bloquea la respuesta)', async () => {
    const res = await ctx
      .http()
      .get('/profiles/public/no-existe')
      .set('Origin', 'https://malicioso.example')
      .expect(404);
    expect(res.headers['access-control-allow-origin']).not.toBe(
      'https://malicioso.example',
    );
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
