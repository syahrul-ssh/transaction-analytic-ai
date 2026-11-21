import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { AnalysisType } from '../../../utils/enums/analysis.enum';

export class CreateAnalysisDto {
  @IsEnum(AnalysisType)
  analysisType: AnalysisType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  importBatchId?: string;
}