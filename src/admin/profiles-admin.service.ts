import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { Page, PaginationQueryDto } from '../common/pagination.dto';
import { LeadsService } from '../leads/leads.service';
import { Profile } from '../profiles/entities/profile.entity';
import { ProfileStatus } from '../profiles/profile.enums';
import { profileUrl } from '../profiles/profile.views';
import { canManageStatus, canView, listScope } from '../users/access-policy';
import { User } from '../users/user.entity';
import { ListProfilesQueryDto } from './dto/admin-profiles.dto';

const notFound = () => new NotFoundException('Perfil no encontrado');

export function toAdminProfileView(profile: Profile) {
  const owner = profile.owner!;
  return {
    id: profile.id,
    slug: profile.slug,
    publicUrl: profileUrl(profile.slug),
    displayName: profile.displayName,
    status: profile.status,
    publishedAt: profile.publishedAt,
    suspendedAt: profile.suspendedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    owner: {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
      status: owner.status,
      organizationId: owner.organizationId,
    },
  };
}
export type AdminProfileView = ReturnType<typeof toAdminProfileView>;

@Injectable()
export class ProfilesAdminService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly leads: LeadsService,
  ) {}

  /** Mismo ámbito que /admin/users: EMPRESA solo ve perfiles de los CLIENTE de su organización. */
  async list(
    actor: User,
    query: ListProfilesQueryDto,
  ): Promise<Page<AdminProfileView>> {
    const scope = listScope(actor);
    const qb = this.profiles
      .createQueryBuilder('profile')
      .innerJoinAndSelect('profile.owner', 'owner')
      .orderBy('profile.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (scope) {
      qb.andWhere('owner.role = :role', { role: scope.role }).andWhere(
        'owner.organizationId = :organizationId',
        { organizationId: scope.organizationId },
      );
    }
    if (query.status)
      qb.andWhere('profile.status = :status', { status: query.status });
    if (query.search) {
      const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('profile.slug ILIKE :term', { term })
            .orWhere('profile.displayName ILIKE :term', { term })
            .orWhere('owner.email ILIKE :term', { term }),
        ),
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(toAdminProfileView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(actor: User, id: string) {
    return toAdminProfileView(await this.findVisible(actor, id));
  }

  async suspend(actor: User, id: string) {
    return this.changeStatus(actor, id, true);
  }

  async reactivate(actor: User, id: string) {
    return this.changeStatus(actor, id, false);
  }

  async listLeads(actor: User, id: string, query: PaginationQueryDto) {
    const profile = await this.findVisible(actor, id);
    return this.leads.listForProfile(profile.id, query);
  }

  /**
   * Suspender oculta el perfil al público y bloquea publicar; reactivar lo deja en
   * borrador para que el propietario lo revise antes de volver a publicarlo.
   */
  private async changeStatus(actor: User, id: string, suspend: boolean) {
    const profile = await this.findVisible(actor, id);
    if (!canManageStatus(actor, profile.owner!)) throw new ForbiddenException();

    const isSuspended = profile.status === ProfileStatus.SUSPENDED;
    if (suspend === isSuspended)
      throw new ConflictException(
        suspend
          ? 'El perfil ya está suspendido'
          : 'El perfil no está suspendido',
      );

    const before = { profileId: profile.id, status: profile.status };
    const changes = suspend
      ? { status: ProfileStatus.SUSPENDED, suspendedAt: new Date() }
      : { status: ProfileStatus.DRAFT, suspendedAt: null, publishedAt: null };

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Profile).update(profile.id, changes);
      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: profile.ownerUserId,
          action: suspend
            ? AuditAction.PROFILE_SUSPENDED
            : AuditAction.PROFILE_REACTIVATED,
          before,
          after: { profileId: profile.id, status: changes.status },
        },
        manager,
      );
    });
    return this.get(actor, id);
  }

  /** Perfil dentro del ámbito del actor; fuera de él responde 404 (no revela existencia). */
  private async findVisible(actor: User, id: string) {
    const profile = await this.profiles.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!profile?.owner || !canView(actor, profile.owner)) throw notFound();
    return profile;
  }
}
