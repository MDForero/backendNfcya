import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
import { UserStatus } from '../users/role.enum';
import { User } from '../users/user.entity';
import { CreateIdentifierDto } from './dto/identifier.dto';
import { ProfileIdentifier } from './entities/profile-identifier.entity';
import {
  IdentifierStatus,
  MAX_IDENTIFIERS_PER_PROFILE,
  ProfileStatus,
} from './profile.enums';
import { toIdentifierView } from './profile.views';
import { ProfilesService } from './profiles.service';

/** Mensaje único para cualquier código que no resuelve: no revela si existió. */
export const IDENTIFIER_UNAVAILABLE = 'Código no disponible';

/** 12 bytes aleatorios → 16 caracteres base64url (96 bits de entropía). */
export function generatePublicCode() {
  return randomBytes(12).toString('base64url');
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{16}$/;

@Injectable()
export class ProfileIdentifiersService {
  constructor(
    @InjectRepository(ProfileIdentifier)
    private readonly identifiers: Repository<ProfileIdentifier>,
    private readonly profiles: ProfilesService,
  ) {}

  async list(user: User) {
    const profile = await this.profiles.getOwn(user);
    const items = await this.identifiers.find({
      where: { profileId: profile.id },
      order: { createdAt: 'DESC' },
    });
    return items.map(toIdentifierView);
  }

  async create(user: User, dto: CreateIdentifierDto) {
    const profile = await this.profiles.getOwn(user);
    const live = await this.identifiers.countBy({
      profileId: profile.id,
      status: Not(IdentifierStatus.REVOKED),
    });
    if (live >= MAX_IDENTIFIERS_PER_PROFILE)
      throw new ConflictException(
        `Un perfil admite como máximo ${MAX_IDENTIFIERS_PER_PROFILE} códigos sin revocar`,
      );

    // Una colisión con 96 bits es prácticamente imposible, pero el índice único manda.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const saved = await this.identifiers.save(
          this.identifiers.create({
            profileId: profile.id,
            kind: dto.kind,
            label: dto.label ?? null,
            publicCode: generatePublicCode(),
          }),
        );
        return toIdentifierView(saved);
      } catch (error) {
        if (!(error instanceof QueryFailedError)) throw error;
        const code = (error.driverError as { code?: string }).code;
        if (code !== '23505') throw error;
      }
    }
    throw new ConflictException('No se pudo generar un código único');
  }

  async changeStatus(user: User, id: string, status: IdentifierStatus) {
    const profile = await this.profiles.getOwn(user);
    const identifier = await this.identifiers.findOneBy({
      id,
      profileId: profile.id,
    });
    if (!identifier) throw new NotFoundException('Código no encontrado');
    if (identifier.status === IdentifierStatus.REVOKED)
      throw new ConflictException(
        'Un código revocado no puede reactivarse; crea uno nuevo',
      );

    identifier.status = status;
    if (status === IdentifierStatus.REVOKED) identifier.revokedAt = new Date();
    return toIdentifierView(await this.identifiers.save(identifier));
  }

  /** Código activo de un perfil publicado con propietario activo → slug. Lo demás, 404. */
  async resolve(code: string) {
    if (!CODE_PATTERN.test(code))
      throw new NotFoundException(IDENTIFIER_UNAVAILABLE);
    const identifier = await this.identifiers.findOne({
      where: {
        publicCode: code,
        status: IdentifierStatus.ACTIVE,
        profile: {
          status: ProfileStatus.PUBLISHED,
          owner: { status: UserStatus.ACTIVA },
        },
      },
      relations: { profile: { owner: true } },
    });
    if (!identifier?.profile)
      throw new NotFoundException(IDENTIFIER_UNAVAILABLE);
    return { slug: identifier.profile.slug, kind: identifier.kind };
  }
}
