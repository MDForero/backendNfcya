import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, UserStatus } from './role.enum';
import { IdentityProvider, UserIdentity } from './user-identity.entity';
import { normalizeEmail, User } from './user.entity';

/** Representación pública de un usuario: nunca incluye hashes ni tokens. */
export interface UserView {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  organization: { id: string; name: string } | null;
  providers: Array<'password' | IdentityProvider>;
  createdAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash?: string | null;
  role?: Role;
  emailVerifiedAt?: Date | null;
  organizationId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
  ) {}

  findById(id: string) {
    return this.users.findOne({
      where: { id },
      relations: { organization: true },
    });
  }

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  /** Incluye passwordHash, que por defecto no se selecciona. */
  findWithPasswordByEmail(email: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findWithPasswordById(id: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  create(data: CreateUserData) {
    return this.users.save(
      this.users.create({
        email: normalizeEmail(data.email),
        name: data.name.trim(),
        passwordHash: data.passwordHash ?? null,
        role: data.role ?? Role.CLIENTE,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        organizationId: data.organizationId ?? null,
      }),
    );
  }

  async markEmailVerified(id: string) {
    await this.users.update(
      { id },
      { emailVerifiedAt: () => 'COALESCE(email_verified_at, now())' },
    );
  }

  async setPasswordHash(id: string, passwordHash: string) {
    await this.users.update({ id }, { passwordHash });
  }

  async updateName(id: string, name: string) {
    await this.users.update({ id }, { name: name.trim() });
  }

  async findByIdentity(provider: IdentityProvider, providerUserId: string) {
    const identity = await this.identities.findOne({
      where: { provider, providerUserId },
      relations: { user: true },
    });
    return identity?.user ?? null;
  }

  async linkIdentity(
    userId: string,
    provider: IdentityProvider,
    providerUserId: string,
  ) {
    await this.identities.save(
      this.identities.create({ userId, provider, providerUserId }),
    );
  }

  /** Carga lo necesario para construir la vista pública de un usuario. */
  async getView(id: string): Promise<UserView | null> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.organization', 'organization')
      .leftJoinAndSelect('user.identities', 'identities')
      .where('user.id = :id', { id })
      .getOne();
    return user ? toUserView(user) : null;
  }
}

export function toUserView(user: User): UserView {
  const providers: UserView['providers'] = [];
  if (user.passwordHash) providers.push('password');
  for (const identity of user.identities ?? [])
    providers.push(identity.provider);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    status: user.status,
    organization: user.organization
      ? { id: user.organization.id, name: user.organization.name }
      : null,
    providers,
    createdAt: user.createdAt,
  };
}
