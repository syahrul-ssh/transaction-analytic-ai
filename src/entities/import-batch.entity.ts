import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ImportStatus } from '../utils/enums/import-status.enum';

@Entity('import_batches')
export class ImportBatch {
  @PrimaryColumn('uuid')
  id: string;

  @Column({
    name: 'original_filename',
    type: 'varchar',
    length: 255,
  })
  originalFilename: string;

  @Column({
    name: 'storage_filename',
    type: 'varchar',
    length: 255,
  })
  storageFilename: string;

  @Column({
    name: 'file_path',
    type: 'text',
  })
  filePath: string;

  @Column({
    name: 'file_size',
    type: 'bigint',
  })
  fileSize: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: ImportStatus.UPLOADED,
  })
  @Index()
  status: ImportStatus;

  @Column({
    name: 'total_rows',
    type: 'integer',
    default: 0,
  })
  totalRows: number;

  @Column({
    name: 'processed_rows',
    type: 'integer',
    default: 0,
  })
  processedRows: number;

  @Column({
    name: 'successful_rows',
    type: 'integer',
    default: 0,
  })
  successfulRows: number;

  @Column({
    name: 'failed_rows',
    type: 'integer',
    default: 0,
  })
  failedRows: number;

  @Column({
    name: 'duplicate_rows',
    type: 'integer',
    default: 0,
  })
  duplicateRows: number;

  @Column({
    name: 'started_at',
    type: 'timestamptz',
    nullable: true,
  })
  startedAt: Date | null;

  @Column({
    name: 'completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  completedAt: Date | null;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage: string | null;

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