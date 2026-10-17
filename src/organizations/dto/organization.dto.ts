import { IsString, Length } from 'class-validator';
import { Trim } from '../../common/trim.transform';

export class OrganizationDto {
  @Trim()
  @IsString()
  @Length(2, 160)
  name: string;
}
