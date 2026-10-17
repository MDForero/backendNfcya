import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Not, Repository } from 'typeorm';
import { EnvironmentVariables } from '../config/env.validation';
import { UserStatus } from '../users/role.enum';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload, AuthErrorCode, RequestMeta } from './auth.types';
import { generateOpaqueToken, hashToken } from './crypto.util';
import { RefreshToken } from './entities/refresh-token.entity';

export interface IssuedSession {
  userId: string;
  accessToken: string;
  /** Segundos de vigencia del access token. */
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  familyId: string;
}

const invalidSession = () =>
  new UnauthorizedException({
    statusCode: 401,
    code: AuthErrorCode.INVALID_SESSION,
    message: 'La sesión no es válida o expiró',
  });

/** Access tokens JWT de corta duración y refresh tokens opacos con rotación por familia. */
@Injectable()
export class SessionsService {
  private readonly accessTtl: number;
  private readonly refreshTtlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.accessTtl = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    this.refreshTtlMs =
      config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) *
      24 *
      60 *
      60 *
      1000;
  }

  /** Abre una sesión nueva (nueva familia de refresh tokens). */
  start(user: Pick<User, 'id' | 'role'>, meta: RequestMeta) {
    return this.issue(user, randomUUID(), meta);
  }

  /**
   * Cambia un refresh token vigente por un par nuevo. Presentar un token ya rotado se
   * trata como robo y revoca todas las sesiones del usuario.
   */
  async rotate(rawToken: string | undefined, meta: RequestMeta) {
    if (!rawToken) throw invalidSession();
    const current = await this.tokens.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!current) throw invalidSession();

    if (current.revokedAt) {
      if (current.replacedById) await this.revokeAll(current.userId);
      throw invalidSession();
    }
    if (current.expiresAt.getTime() <= Date.now()) throw invalidSession();

    const user = await this.users.findById(current.userId);
    if (!user || user.status !== UserStatus.ACTIVA) {
      await this.revokeAll(current.userId);
      throw invalidSession();
    }

    // Marcar primero como revocado (condicionado a que siga vigente) evita que dos
    // renovaciones simultáneas con el mismo token emitan dos sesiones.
    const claimed = await this.tokens.update(
      { id: current.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!claimed.affected) {
      await this.revokeAll(current.userId);
      throw invalidSession();
    }

    const session = await this.issue(user, current.familyId, meta);
    await this.tokens.update(
      { id: current.id },
      { replacedById: session.tokenId },
    );
    return { user, session };
  }

  /** Cierra la sesión del refresh token indicado (si existe). Devuelve su familia. */
  async revoke(rawToken: string | undefined) {
    if (!rawToken) return null;
    const token = await this.tokens.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!token) return null;
    await this.tokens.update(
      { familyId: token.familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return token;
  }

  async revokeAll(userId: string) {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Revoca todas las sesiones del usuario salvo la familia del refresh token indicado. */
  async revokeOthers(userId: string, currentRawToken: string | undefined) {
    const current = currentRawToken
      ? await this.tokens.findOne({
          where: { tokenHash: hashToken(currentRawToken), userId },
        })
      : null;
    if (!current) return this.revokeAll(userId);
    await this.tokens.update(
      { userId, familyId: Not(current.familyId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issue(
    user: Pick<User, 'id' | 'role'>,
    familyId: string,
    meta: RequestMeta,
  ) {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
    });
    const { token, hash } = generateOpaqueToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
    const saved = await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        familyId,
        tokenHash: hash,
        expiresAt: refreshExpiresAt,
        revokedAt: null,
        replacedById: null,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    );
    return {
      userId: user.id,
      accessToken,
      expiresIn: this.accessTtl,
      refreshToken: token,
      refreshExpiresAt,
      familyId,
      tokenId: saved.id,
    } satisfies IssuedSession & { tokenId: string };
  }
}
