import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Role, UserStatus } from './role.enum';
import { UserIdentity } from './user-identity.entity';

@Entity('users')
@Check(
  'CHK_users_empresa_has_org',
  `"role" <> 'EMPRESA' OR "organization_id" IS NOT NULL`,
)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Siempre en minúsculas; ver normalizeEmail. */
  @Index('UQ_users_email', { unique: true })
  @Column({ length: 254 })
  email: string;

  @Column({ length: 120 })
  name: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  passwordHash?: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({
    type: 'enum',
    enum: Role,
    enumName: 'user_role',
    default: Role.CLIENTE,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVA,
  })
  status: UserStatus;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization | null;

  @OneToMany(() => UserIdentity, (identity) => identity.user)
  identities?: UserIdentity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
