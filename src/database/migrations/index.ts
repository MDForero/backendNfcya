import type { MixedList } from 'typeorm';
import { InitIdentity1791842887450 } from './1791842887450-InitIdentity';
import { ProfilesMvp1794247996513 } from './1794247996513-ProfilesMvp';
import { AdminUserLifecycle1794510000000 } from './1794510000000-AdminUserLifecycle';

/** Registra aquí cada migración nueva (orden cronológico). */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MIGRATIONS: MixedList<Function> = [
  InitIdentity1791842887450,
  ProfilesMvp1794247996513,
  AdminUserLifecycle1794510000000,
];
