import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Repository } from 'typeorm';
import { hashPassword } from '../auth/crypto.util';
import { RegisterDto } from '../auth/dto/auth.dto';
import { Role, UserStatus } from './role.enum';
import { normalizeEmail, User } from './user.entity';

export interface BootstrapAdminInput {
  email?: string;
  password?: string;
  name?: string;
}

export type BootstrapResult = 'created' | 'skipped';

/** Crea el primer SUPER_ADMIN. Si ya existe alguno, no toca nada. */
@Injectable()
export class BootstrapAdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async run(input: BootstrapAdminInput): Promise<BootstrapResult> {
    const dto = plainToInstance(RegisterDto, {
      email: input.email,
      password: input.password,
      name: input.name || 'Administrador',
    });
    const errors = validateSync(dto);
    if (errors.length) {
      const detail = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      throw new Error(`BOOTSTRAP_ADMIN_* inválidas: ${detail}`);
    }

    if (await this.users.exists({ where: { role: Role.SUPER_ADMIN } }))
      return 'skipped';

    const email = normalizeEmail(dto.email);
    if (await this.users.exists({ where: { email } })) {
      throw new Error(
        `Ya existe un usuario con el email ${email}; usa otro para el SUPER_ADMIN`,
      );
    }

    await this.users.save(
      this.users.create({
        email,
        name: dto.name,
        passwordHash: await hashPassword(dto.password),
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVA,
        emailVerifiedAt: new Date(),
        organizationId: null,
      }),
    );
    return 'created';
  }
}
