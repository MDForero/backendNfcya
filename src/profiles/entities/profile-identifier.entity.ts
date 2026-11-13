import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IdentifierKind, IdentifierStatus } from '../profile.enums';
import { Profile } from './profile.entity';

/** Código opaco que se graba en un chip NFC o se imprime como QR (URL /r/:code). */
@Entity('profile_identifiers')
export class ProfileIdentifier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_profile_identifiers_profile')
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile;

  @Column({
    type: 'enum',
    enum: IdentifierKind,
    enumName: 'identifier_kind',
  })
  kind: IdentifierKind;

  @Column({ type: 'varchar', length: 60, nullable: true })
  label: string | null;

  /** Aleatorio (96 bits, base64url): no secuencial ni derivable del perfil. */
  @Index('UQ_profile_identifiers_code', { unique: true })
  @Column({ name: 'public_code', length: 32 })
  publicCode: string;

  @Column({
    type: 'enum',
    enum: IdentifierStatus,
    enumName: 'identifier_status',
    default: IdentifierStatus.ACTIVE,
  })
  status: IdentifierStatus;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
