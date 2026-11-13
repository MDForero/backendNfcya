import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { AccountEmailsService } from '../auth/account-emails.service';
import { GENERIC_ACCEPTED } from '../auth/auth.service';
import { SessionsService } from '../auth/sessions.service';
import { Page } from '../common/pagination.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { canManageStatus, canView, listScope } from '../users/access-policy';
import { Role, UserStatus } from '../users/role.enum';
import { normalizeEmail, User } from '../users/user.entity';
import { toUserView, UsersService, UserView } from '../users/users.service';
import { CreateAdminUserDto, ListUsersQueryDto } from './dto/admin-users.dto';

const notFound = () => new NotFoundException('Usuario no encontrado');

/** Clave del advisory lock que serializa cambios que pueden dejar sin SUPER_ADMIN. */
const SUPER_ADMIN_GUARD_LOCK = 7_310_001;
@Injectable()
export class UsersAdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly organizations: OrganizationsService,
    private readonly sessions: SessionsService,
    private readonly accountEmails: AccountEmailsService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: User, query: ListUsersQueryDto): Promise<Page<UserView>> {
    const scope = listScope(actor);
    const qb = this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.organization', 'organization')
      .leftJoinAndSelect('user.identities', 'identities')
      .orderBy('user.createdAt', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    const role = scope?.role ?? query.role;
    const organizationId = scope?.organizationId ?? query.organizationId;
    if (role) qb.andWhere('user.role = :role', { role });
    if (organizationId)
      qb.andWhere('user.organizationId = :organizationId', { organizationId });
    if (query.status)
      qb.andWhere('user.status = :status', { status: query.status });
    if (query.search) {
      const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('user.email ILIKE :term', { term })
            .orWhere('user.name ILIKE :term', { term }),
        ),
      );
    }

    const [users, total] = await qb.getManyAndCount();
    return {
      items: users.map(toUserView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(actor: User, id: string) {
    await this.findVisible(actor, id);
    return (await this.users.getView(id))!;
  }

  /**
   * Alta de un SUPER_ADMIN o SOPORTE. La cuenta nace sin contraseña ni correo verificado:
   * el invitado define su clave con el enlace del correo (eso también verifica el email).
   */
  async createAdmin(actor: User, dto: CreateAdminUserDto) {
    const email = normalizeEmail(dto.email);
    const created = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      if (await repo.exists({ where: { email } })) {
        throw new ConflictException(
          'Ya existe un usuario con ese email; cambia su rol desde el listado',
        );
      }
      const user = await repo.save(
        repo.create({
          email,
          name: dto.name,
          passwordHash: null,
          role: dto.role,
          status: UserStatus.ACTIVA,
          emailVerifiedAt: null,
          organizationId: null,
        }),
      );
      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: user.id,
          action: AuditAction.USER_CREATED,
          after: { email, name: dto.name, role: dto.role },
        },
        manager,
      );
      return user;
    });

    await this.accountEmails.sendAdminInvitation(
      created,
      dto.role === Role.SUPER_ADMIN ? 'Super Admin' : 'Soporte',
    );
    return (await this.users.getView(created.id))!;
  }

  /**
   * Borrado definitivo. La BD elimina en cascada perfil, enlaces, códigos NFC/QR, leads,
   * tokens e identidades. La auditoría se conserva (sin FK) con los datos del borrado.
   */
  async remove(actor: User, id: string) {
    if (actor.id === id)
      throw new BadRequestException('No puedes eliminar tu propia cuenta');

    await this.dataSource.transaction(async (manager) => {
      await this.lockSuperAdminGuard(manager);
      const target = await this.lockUser(manager, id);
      if (target.role === Role.SUPER_ADMIN)
        await this.assertNotLastSuperAdmin(manager, target);

      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: id,
          action: AuditAction.USER_DELETED,
          before: {
            email: target.email,
            name: target.name,
            role: target.role,
            status: target.status,
            organizationId: target.organizationId,
          },
        },
        manager,
      );
      await manager.delete(User, { id });
    });
  }

  async changeRole(actor: User, id: string, role: Role) {
    if (actor.id === id)
      throw new BadRequestException('No puedes cambiar tu propio rol');

    await this.dataSource.transaction(async (manager) => {
      await this.lockSuperAdminGuard(manager);
      const target = await this.lockUser(manager, id);
      if (target.role === role) return;
      if (role === Role.EMPRESA && !target.organizationId) {
        throw new BadRequestException(
          'Para asignar EMPRESA el usuario debe pertenecer a una organización',
        );
      }
      if (target.role === Role.SUPER_ADMIN)
        await this.assertNotLastSuperAdmin(manager, target);

      await manager.update(User, { id }, { role });
      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: id,
          action: AuditAction.ROLE_CHANGED,
          before: { role: target.role },
          after: { role },
        },
        manager,
      );
    });
    return (await this.users.getView(id))!;
  }

  async changeOrganization(
    actor: User,
    id: string,
    organizationId: string | null,
  ) {
    if (
      organizationId &&
      !(await this.organizations.findById(organizationId))
    ) {
      throw new NotFoundException('Organización no encontrada');
    }

    await this.dataSource.transaction(async (manager) => {
      const target = await this.lockUser(manager, id);
      if (target.organizationId === organizationId) return;
      if (!organizationId && target.role === Role.EMPRESA) {
        throw new BadRequestException(
          'Un usuario EMPRESA debe pertenecer a una organización',
        );
      }

      await manager.update(User, { id }, { organizationId });
      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: id,
          action: AuditAction.ORGANIZATION_CHANGED,
          before: { organizationId: target.organizationId },
          after: { organizationId },
        },
        manager,
      );
    });
    return (await this.users.getView(id))!;
  }

  suspend(actor: User, id: string) {
    return this.setStatus(actor, id, UserStatus.SUSPENDIDA);
  }

  reactivate(actor: User, id: string) {
    return this.setStatus(actor, id, UserStatus.ACTIVA);
  }

  async resendVerification(actor: User, id: string) {
    const target = await this.findVisible(actor, id);
    if (target.emailVerifiedAt)
      throw new ConflictException('El correo ya está verificado');
    await this.accountEmails.sendVerification(target);
    return GENERIC_ACCEPTED;
  }

  async sendPasswordReset(actor: User, id: string) {
    const target = await this.findVisible(actor, id);
    await this.accountEmails.sendPasswordReset(target);
    return GENERIC_ACCEPTED;
  }

  private async setStatus(actor: User, id: string, status: UserStatus) {
    if (actor.id === id)
      throw new BadRequestException(
        'No puedes cambiar el estado de tu propia cuenta',
      );
    const visible = await this.findVisible(actor, id);
    if (!canManageStatus(actor, visible)) throw new ForbiddenException();

    let changed = false;
    await this.dataSource.transaction(async (manager) => {
      await this.lockSuperAdminGuard(manager);
      const target = await this.lockUser(manager, id);
      if (target.status === status) return;
      if (
        status === UserStatus.SUSPENDIDA &&
        target.role === Role.SUPER_ADMIN
      ) {
        await this.assertNotLastSuperAdmin(manager, target);
      }

      await manager.update(User, { id }, { status });
      await this.audit.record(
        {
          actorId: actor.id,
          targetUserId: id,
          action:
            status === UserStatus.SUSPENDIDA
              ? AuditAction.USER_SUSPENDED
              : AuditAction.USER_REACTIVATED,
          before: { status: target.status },
          after: { status },
        },
        manager,
      );
      changed = true;
    });

    if (changed && status === UserStatus.SUSPENDIDA)
      await this.sessions.revokeAll(id);
    return (await this.users.getView(id))!;
  }

  /** 404 tanto si no existe como si el actor no puede verlo, para no revelar cuentas. */
  private async findVisible(actor: User, id: string) {
    const target = await this.users.findById(id);
    if (!target || !canView(actor, target)) throw notFound();
    return target;
  }

  private async lockUser(manager: EntityManager, id: string) {
    const user = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw notFound();
    return user;
  }

  /**
   * Serializa los cambios de rol y de estado. Debe tomarse antes de lockUser:
   * si no, dos degradaciones cruzadas bloquean cada una la fila de la otra y
   * PostgreSQL aborta una por deadlock (500) en vez de responder 409.
   */
  private async lockSuperAdminGuard(manager: EntityManager) {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [
      SUPER_ADMIN_GUARD_LOCK,
    ]);
  }

  /** Bloquea a los SUPER_ADMIN activos para que dos operaciones simultáneas no dejen cero. */
  private async assertNotLastSuperAdmin(manager: EntityManager, target: User) {
    if (target.status !== UserStatus.ACTIVA) return;
    const activeAdmins = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.role = :role', { role: Role.SUPER_ADMIN })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVA })
      .getMany();
    if (activeAdmins.length <= 1) {
      throw new ConflictException(
        'La plataforma debe conservar al menos un SUPER_ADMIN activo',
      );
    }
  }
}
