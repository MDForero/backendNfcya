import { Role } from './role.enum';

export interface PolicySubject {
  id: string;
  role: Role;
  organizationId: string | null;
}

/** Roles que pueden ver cualquier usuario de la plataforma. */
const GLOBAL_READERS = [Role.SUPER_ADMIN, Role.SOPORTE];

/** EMPRESA solo alcanza a los CLIENTE de su propia organización. */
function isOwnOrgClient(actor: PolicySubject, target: PolicySubject) {
  return (
    actor.role === Role.EMPRESA &&
    actor.organizationId !== null &&
    target.role === Role.CLIENTE &&
    target.organizationId === actor.organizationId
  );
}

/** ¿Puede el actor consultar al usuario objetivo desde las rutas administrativas? */
export function canView(actor: PolicySubject, target: PolicySubject) {
  return GLOBAL_READERS.includes(actor.role) || isOwnOrgClient(actor, target);
}

/** ¿Puede el actor suspender o reactivar al usuario objetivo? Nadie puede sobre sí mismo. */
export function canManageStatus(actor: PolicySubject, target: PolicySubject) {
  if (actor.id === target.id) return false;
  return actor.role === Role.SUPER_ADMIN || isOwnOrgClient(actor, target);
}

/** Filtro obligatorio para los listados según el rol del actor (null = sin restricción). */
export function listScope(
  actor: PolicySubject,
): { role: Role; organizationId: string } | null {
  if (GLOBAL_READERS.includes(actor.role)) return null;
  if (actor.role === Role.EMPRESA && actor.organizationId) {
    return { role: Role.CLIENTE, organizationId: actor.organizationId };
  }
  throw new Error(`El rol ${actor.role} no puede listar usuarios`);
}
