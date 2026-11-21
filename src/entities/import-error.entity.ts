import {
  CreateDateColumn,
  Entity,
  Column,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('import_errors')
@Index('idx_import_errors_batch_id', ['importBatchId'])
export class ImportError {
  @PrimaryColumn('uuid')
  id: string;

  @Column({
    name: 'import_batch_id',
    type: 'uuid',
  })
  importBatchId: string;

  @Column({
    name: 'row_number',
    type: 'integer',
  })
  rowNumber: number;

  @Column({
    name: 'raw_data',
    type: 'jsonb',
  })
  rawData: Record<string, unknown>;

  @Column({
    name: 'error_code',
    type: 'varchar',
    length: 100,
  })
  errorCode: string;

  @Column({
    name: 'error_message',
    type: 'text',
  })
  errorMessage: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}