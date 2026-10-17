import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { generateOpaqueToken, hashToken } from './crypto.util';
import {
  OneTimeToken,
  OneTimeTokenType,
} from './entities/one-time-token.entity';

const TTL_MS: Record<OneTimeTokenType, number> = {
  [OneTimeTokenType.VERIFY_EMAIL]: 24 * 60 * 60 * 1000,
  [OneTimeTokenType.RESET_PASSWORD]: 60 * 60 * 1000,
};

/** Tokens de un solo uso para verificar el correo y restablecer la contraseña. */
@Injectable()
export class OneTimeTokensService {
  constructor(
    @InjectRepository(OneTimeToken)
    private readonly tokens: Repository<OneTimeToken>,
  ) {}

  /** Crea un token nuevo e invalida los pendientes del mismo tipo para ese usuario. */
  async create(userId: string, type: OneTimeTokenType) {
    await this.tokens.update(
      { userId, type, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const { token, hash } = generateOpaqueToken();
    await this.tokens.save(
      this.tokens.create({
        userId,
        type,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + TTL_MS[type]),
        usedAt: null,
      }),
    );
    return token;
  }

  /** Consume un token vigente y no usado. Devuelve el userId o null si no es válido. */
  async consume(rawToken: string, type: OneTimeTokenType) {
    const result = await this.tokens
      .createQueryBuilder()
      .update()
      .set({ usedAt: () => 'now()' })
      .where({
        tokenHash: hashToken(rawToken),
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      })
      .returning(['userId'])
      .execute();
    const row = (result.raw as Array<{ user_id: string }>)[0];
    return row?.user_id ?? null;
  }
}
