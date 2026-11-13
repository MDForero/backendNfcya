import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Trim } from '../../common/trim.transform';
import { ProfileStatus } from '../../profiles/profile.enums';

export class ListProfilesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProfileStatus)
  status?: ProfileStatus;

  /** Busca por slug, nombre visible o email del propietario. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(254)
  search?: string;
}
