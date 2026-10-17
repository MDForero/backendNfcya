import {
  burnPasswordCheck,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './crypto.util';

describe('crypto.util', () => {
  it('hashea con argon2id y verifica la contraseña correcta', async () => {
    const hash = await hashPassword('Secreta123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Secreta123');
    await expect(verifyPassword(hash, 'Secreta123')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'Otra12345')).resolves.toBe(false);
  });

  it('usa una sal distinta en cada hash', async () => {
    const [a, b] = await Promise.all([
      hashPassword('Secreta123'),
      hashPassword('Secreta123'),
    ]);
    expect(a).not.toBe(b);
  });

  it('devuelve false con un hash corrupto en lugar de lanzar', async () => {
    await expect(verifyPassword('no-es-un-hash', 'x')).resolves.toBe(false);
  });

  it('burnPasswordCheck siempre devuelve false', async () => {
    await expect(burnPasswordCheck('lo-que-sea')).resolves.toBe(false);
  });

  it('genera tokens opacos únicos cuyo hash es SHA-256 del token', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
