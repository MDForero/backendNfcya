import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim.transform';
import { IdentifierKind, IdentifierStatus } from '../profile.enums';

export class CreateIdentifierDto {
  @IsEnum(IdentifierKind, { message: 'kind debe ser NFC o QR' })
  kind: IdentifierKind;

  /** Nombre interno, p. ej. "Tarjeta de Ana". */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  label?: string;
}

export class ChangeIdentifierStatusDto {
  @IsIn(Object.values(IdentifierStatus), {
    message: 'status debe ser ACTIVE, INACTIVE o REVOKED',
  })
  status: IdentifierStatus;
}
