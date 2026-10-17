import { validateEnv } from './env.validation';

const base = {
  FRONTEND_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
};

describe('validateEnv', () => {
  it('acepta una configuración mínima y aplica valores por defecto', () => {
    const env = validateEnv({ ...base });
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.MAIL_TRANSPORT).toBe('log');
  });

  it('convierte strings del entorno a números y booleanos', () => {
    const env = validateEnv({ ...base, PORT: '4000', COOKIE_SECURE: 'false' });
    expect(env.PORT).toBe(4000);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it.each(['DATABASE_URL', 'JWT_ACCESS_SECRET', 'FRONTEND_URL'])(
    'falla si falta %s',
    (key) => {
      const config: Record<string, unknown> = { ...base };
      delete config[key];
      expect(() => validateEnv(config)).toThrow(key);
    },
  );

  it('falla con un secreto JWT corto', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
  });

  it('exige SMTP_HOST cuando el transporte es smtp', () => {
    expect(() => validateEnv({ ...base, MAIL_TRANSPORT: 'smtp' })).toThrow(
      'SMTP_HOST',
    );
  });
});
