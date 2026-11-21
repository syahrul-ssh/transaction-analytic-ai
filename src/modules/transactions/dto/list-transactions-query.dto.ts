import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { TransactionType } from '../../../utils/enums/transaction-type.enum';
import { TransactionSortField } from '../../../utils/enums/transaction-sort-field.enum';

export class ListTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.toUpperCase()
      : value,
  )
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsString()
  importBatchId?: string;

  @IsOptional()
  @IsEnum(TransactionSortField)
  sortBy?: TransactionSortField;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.toUpperCase()
      : value,
  )
  @IsEnum(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}