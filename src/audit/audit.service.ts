import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';

export interface AuditEntry {
  actorId: string;
  targetUserId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  /** Registra una acción administrativa; acepta un EntityManager para ir en la misma transacción. */
  record(entry: AuditEntry, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(AuditLog) : this.logs;
    return repo.save(
      repo.create({
        actorId: entry.actorId,
        targetUserId: entry.targetUserId,
        action: entry.action,
        before: entry.before ?? null,
        after: entry.after ?? null,
      }),
    );
  }

  findForUser(targetUserId: string) {
    return this.logs.find({
      where: { targetUserId },
      order: { createdAt: 'DESC' },
    });
  }
}
