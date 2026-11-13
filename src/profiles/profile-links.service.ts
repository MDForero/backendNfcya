import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { definedOnly } from '../common/trim.transform';
import { User } from '../users/user.entity';
import { CreateLinkDto, UpdateLinkDto } from './dto/link.dto';
import { ProfileLink } from './entities/profile-link.entity';
import { Profile } from './entities/profile.entity';
import { LinkType, MAX_LINKS_PER_PROFILE } from './profile.enums';
import { sortLinks, toLinkView } from './profile.views';
import { ProfilesService } from './profiles.service';

const linkNotFound = () => new NotFoundException('Enlace no encontrado');

@Injectable()
export class ProfileLinksService {
  constructor(
    @InjectRepository(ProfileLink)
    private readonly links: Repository<ProfileLink>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profiles: ProfilesService,
  ) {}

  async list(user: User) {
    const profile = await this.profiles.getOwn(user);
    return sortLinks(profile.links).map(toLinkView);
  }

  async create(user: User, dto: CreateLinkDto) {
    const profile = await this.profiles.getOwn(user);
    const existing = profile.links ?? [];
    if (existing.length >= MAX_LINKS_PER_PROFILE)
      throw new ConflictException(
        `Un perfil admite como máximo ${MAX_LINKS_PER_PROFILE} enlaces`,
      );
    const nextOrder =
      existing.reduce((max, link) => Math.max(max, link.sortOrder), -1) + 1;
    const link = await this.links.save(
      this.links.create({
        profileId: profile.id,
        label: dto.label,
        url: dto.url,
        type: dto.type ?? LinkType.OTHER,
        isActive: dto.isActive ?? true,
        sortOrder: nextOrder,
      }),
    );
    return toLinkView(link);
  }

  async update(user: User, id: string, dto: UpdateLinkDto) {
    const link = await this.findOwn(user, id);
    Object.assign(link, definedOnly(dto));
    return toLinkView(await this.links.save(link));
  }

  async remove(user: User, id: string) {
    const link = await this.findOwn(user, id);
    await this.links.delete(link.id);
  }

  /** Reordena todos los enlaces del perfil en una transacción; exige el conjunto completo. */
  async reorder(user: User, ids: string[]) {
    const profile = await this.profiles.getOwn(user);
    const own = new Set((profile.links ?? []).map((link) => link.id));
    if (ids.length !== own.size || ids.some((id) => !own.has(id)))
      throw new BadRequestException(
        'ids debe contener exactamente todos los enlaces del perfil',
      );

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProfileLink);
      for (const [index, id] of ids.entries()) {
        await repo.update({ id, profileId: profile.id }, { sortOrder: index });
      }
    });
    return this.list(user);
  }

  /** Busca un enlace solo dentro del perfil del usuario: los ajenos responden 404. */
  private async findOwn(user: User, id: string) {
    const profile: Profile = await this.profiles.getOwn(user);
    const link = await this.links.findOneBy({ id, profileId: profile.id });
    if (!link) throw linkNotFound();
    return link;
  }
}
