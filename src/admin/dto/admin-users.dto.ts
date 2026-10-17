import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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
