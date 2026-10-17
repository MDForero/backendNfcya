import { IsString, Length } from 'class-validator';
import { Trim } from '../../common/trim.transform';

export class UpdateMeDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  name: string;
}
