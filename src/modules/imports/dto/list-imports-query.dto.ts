import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ImportStatus } from '../../../utils/enums/import-status.enum';

export class ListImportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;

  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}