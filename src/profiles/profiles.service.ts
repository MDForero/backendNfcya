import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { definedOnly } from '../common/trim.transform';
import { UserStatus } from '../users/role.enum';
import { User } from '../users/user.entity';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto';
import { Profile } from './entities/profile.entity';
import { ProfileStatus } from './profile.enums';
import { toOwnerView } from './profile.views';
import { normalizeSlug, slugProblem } from './slug.util';

export const PROFILE_NOT_FOUND = 'Perfil no encontrado';
const SLUG_TAKEN = 'Ese slug ya está en uso';

function isUniqueViolation(error: unknown, constraint: string) {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; constraint?: string };
  return driver.code === '23505' && driver.constraint === constraint;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
  ) {}

  /** Perfil del usuario (con enlaces) o 404. Es el único punto de entrada a recursos "me". */
  async getOwn(user: User): Promise<Profile> {
    const profile = await this.profiles.findOne({
      where: { ownerUserId: user.id },
      relations: { links: true },
    });
    if (!profile) throw new NotFoundException(PROFILE_NOT_FOUND);
    return profile;
  }

  async getOwnView(user: User) {
    return toOwnerView(await this.getOwn(user));
  }

  async create(user: User, dto: CreateProfileDto) {
    if (await this.profiles.existsBy({ ownerUserId: user.id }))
      throw new ConflictException('Ya tienes un perfil');
    await this.assertSlugFree(dto.slug);

    const profile = this.profiles.create({
      ...definedOnly(dto),
      ownerUserId: user.id,
      status: ProfileStatus.DRAFT,
    });
    await this.save(profile);
    return this.getOwnView(user);
  }

  async update(user: User, dto: UpdateProfileDto) {
    const profile = await this.getOwn(user);
    if (dto.slug !== undefined && dto.slug !== profile.slug)
      await this.assertSlugFree(dto.slug, profile.id);

    // Solo campos del DTO (whitelist del ValidationPipe); nunca estado, dueño ni fechas.
    Object.assign(profile, definedOnly(dto));
    delete profile.links; // los enlaces tienen sus propias rutas
    await this.save(profile);
    return this.getOwnView(user);
  }

  async slugAvailability(user: User, raw: string) {
    const slug = normalizeSlug(raw);
    const problem = slugProblem(slug);
    if (problem) return { slug, available: false, reason: problem };
    const holder = await this.profiles.findOne({
      where: { slug },
      select: { id: true, ownerUserId: true },
    });
    if (holder && holder.ownerUserId !== user.id)
      return { slug, available: false, reason: SLUG_TAKEN };
    return { slug, available: true, reason: null };
  }

  async publish(user: User) {
    const profile = await this.getOwn(user);
    this.assertNotSuspended(profile);
    if (profile.status !== ProfileStatus.PUBLISHED) {
      await this.profiles.update(profile.id, {
        status: ProfileStatus.PUBLISHED,
        publishedAt: new Date(),
      });
    }
    return this.getOwnView(user);
  }

  async unpublish(user: User) {
    const profile = await this.getOwn(user);
    this.assertNotSuspended(profile);
    await this.profiles.update(profile.id, { status: ProfileStatus.DRAFT });
    return this.getOwnView(user);
  }

  /**
   * Perfil visible al público: publicado y con propietario activo. Cualquier otro caso
   * (inexistente, borrador, suspendido, cuenta suspendida) responde igual: 404.
   */
  async findPublished(slug: string): Promise<Profile> {
    const normalized = normalizeSlug(slug);
    const profile = normalized
      ? await this.profiles.findOne({
          where: {
            slug: normalized,
            status: ProfileStatus.PUBLISHED,
            owner: { status: UserStatus.ACTIVA },
          },
          relations: { links: true, owner: true },
        })
      : null;
    if (!profile) throw new NotFoundException(PROFILE_NOT_FOUND);
    return profile;
  }

  private assertNotSuspended(profile: Profile) {
    if (profile.status === ProfileStatus.SUSPENDED)
      throw new ForbiddenException(
        'El perfil está suspendido por administración',
      );
  }

  private async assertSlugFree(slug: string, exceptProfileId?: string) {
    const holder = await this.profiles.findOne({
      where: { slug },
      select: { id: true },
    });
    if (holder && holder.id !== exceptProfileId)
      throw new ConflictException(SLUG_TAKEN);
  }

  /** Traduce las carreras contra los índices únicos en 409 coherentes. */
  private async save(profile: Profile) {
    try {
      return await this.profiles.save(profile);
    } catch (error) {
      if (isUniqueViolation(error, 'UQ_profiles_slug'))
        throw new ConflictException(SLUG_TAKEN);
      if (isUniqueViolation(error, 'UQ_profiles_owner'))
        throw new ConflictException('Ya tienes un perfil');
      throw error;
    }
  }
}
