import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnalysisStatus, AnalysisType } from '../utils/enums/analysis.enum';

@Entity('transaction_analyses')
@Index(['status', 'createdAt'])
export class TransactionAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'analysis_type',
    type: 'text',
  })
  analysisType: AnalysisType;

  @Column({
    name: 'status',
    type: 'text',
    default: AnalysisStatus.PENDING,
  })
  status: AnalysisStatus;

  @Column({
    name: 'parameters',
    type: 'jsonb',
    nullable: true,
  })
  parameters: Record<string, any>;

  @Column({
    name: 'dataset_summary',
    type: 'jsonb',
    nullable: true,
  })
  datasetSummary: Record<string, any>;

  @Column({
    name: 'result',
    type: 'jsonb',
    nullable: true,
  })
  result: Record<string, any>;

  @Column({
    name: 'prompt_version',
    type: 'text',
    nullable: true,
  })
  promptVersion: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  model: string;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage: string;

  @Column({
    name: 'retry_count',
    type: 'int',
    default: 0,
  })
  retryCount: number;

  @Column({
    name: 'started_at',
    type: 'timestamp',
    nullable: true,
  })
  startedAt: Date;

  @Column({
    name: 'completed_at',
    type: 'timestamp',
    nullable: true,
  })
  completedAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}