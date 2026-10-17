import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum OneTimeTokenType {
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

@Entity('one_time_tokens')
export class OneTimeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_one_time_tokens_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    type: 'enum',
    enum: OneTimeTokenType,
    enumName: 'one_time_token_type',
  })
  type: OneTimeTokenType;

  @Index('UQ_one_time_tokens_hash', { unique: true })
  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
