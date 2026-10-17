import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AuditAction {
  ROLE_CHANGED = 'ROLE_CHANGED',
  ORGANIZATION_CHANGED = 'ORGANIZATION_CHANGED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Index('IDX_audit_logs_target')
  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId: string;

  @Column({ type: 'enum', enum: AuditAction, enumName: 'audit_action' })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
