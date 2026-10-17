import { Repository } from 'typeorm';
import { Role } from '../users/role.enum';
import { AuditAction, AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('guarda actor, afectado, acción y los valores antes/después', async () => {
    const save = jest.fn((entity: AuditLog) => Promise.resolve(entity));
    const repo = {
      create: (data: Partial<AuditLog>) => data as AuditLog,
      save,
    } as unknown as Repository<AuditLog>;

    await new AuditService(repo).record({
      actorId: 'admin-1',
      targetUserId: 'user-9',
      action: AuditAction.ROLE_CHANGED,
      before: { role: Role.CLIENTE },
      after: { role: Role.SOPORTE },
    });

    expect(save).toHaveBeenCalledWith({
      actorId: 'admin-1',
      targetUserId: 'user-9',
      action: AuditAction.ROLE_CHANGED,
      before: { role: Role.CLIENTE },
      after: { role: Role.SOPORTE },
    });
  });

  it('usa null cuando no hay valores antes/después', async () => {
    const save = jest.fn((entity: AuditLog) => Promise.resolve(entity));
    const repo = {
      create: (d: Partial<AuditLog>) => d,
      save,
    } as unknown as Repository<AuditLog>;

    await new AuditService(repo).record({
      actorId: 'a',
      targetUserId: 'b',
      action: AuditAction.USER_SUSPENDED,
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ before: null, after: null }),
    );
  });
});
