import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Trim } from '../../common/trim.transform';
import { Role, UserStatus } from '../../users/role.enum';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  /** Busca por nombre o email. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(254)
  search?: string;
}

export class ChangeRoleDto {
  @IsEnum(Role, {
    message: `role debe ser uno de: ${Object.values(Role).join(', ')}`,
  })
  role: Role;
}

export class ChangeOrganizationDto {
  /** null quita la organización. */
  @ValidateIf((dto: ChangeOrganizationDto) => dto.organizationId !== null)
  @IsUUID()
  organizationId: string | null;
}

/** Roles que un SUPER_ADMIN puede crear directamente (el resto se registra solo). */
export const CREATABLE_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SOPORTE] as const;

export class CreateAdminUserDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  name: string;

  @Trim()
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(254)
  email: string;

  @IsIn(CREATABLE_ADMIN_ROLES, {
    message: `role debe ser uno de: ${CREATABLE_ADMIN_ROLES.join(', ')}`,
  })
  role: (typeof CREATABLE_ADMIN_ROLES)[number];
}
