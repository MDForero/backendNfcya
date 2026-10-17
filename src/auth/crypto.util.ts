import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Hash fijo para gastar el mismo tiempo cuando el usuario no existe o no tiene contraseña. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(await dummyHash, password);
  return false;
}

/** SHA-256 hex: suficiente para tokens opacos de alta entropía. */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Genera un token opaco de 32 bytes (base64url) y su hash para persistir. */
export function generateOpaqueToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
