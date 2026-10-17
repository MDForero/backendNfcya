import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('login_attempts')
@Index('IDX_login_attempts_email_created', ['email', 'createdAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column()
  succeeded: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
