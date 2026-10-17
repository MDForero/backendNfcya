import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export type IdentityProvider = 'google';

@Entity('user_identities')
@Index('UQ_user_identities_provider_subject', ['provider', 'providerUserId'], {
  unique: true,
})
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_user_identities_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 32 })
  provider: IdentityProvider;

  @Column({ name: 'provider_user_id', length: 255 })
  providerUserId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
