import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/role.enum';

export const ROLES_KEY = 'roles';

/** Restringe la ruta a los roles indicados. Sin decorador, basta con estar autenticado. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
