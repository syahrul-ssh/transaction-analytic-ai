import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionType } from '../utils/enums/transaction-type.enum';

@Entity('transactions')
@Index('uq_transactions_external_transaction_id', [
  'externalTransactionId',
], {
  unique: true,
})
@Index('idx_transactions_transaction_date', [
  'transactionDate',
])
@Index('idx_transactions_category', [
  'category',
])
@Index('idx_transactions_merchant', [
  'merchant',
])
export class Transaction {
  @PrimaryColumn('uuid')
  id: string;

  @Column({
    name: 'external_transaction_id',
    type: 'varchar',
    length: 255,
  })
  externalTransactionId: string;

  @Column({
    name: 'import_batch_id',
    type: 'uuid',
  })
  importBatchId: string;

  @Column({
    name: 'transaction_date',
    type: 'date',
  })
  transactionDate: string;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
  })
  amount: string;

  @Column({
    type: 'varchar',
    length: 3,
  })
  currency: string;

  @Column({
    name: 'transaction_type',
    type: 'varchar',
    length: 20,
  })
  transactionType: TransactionType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  merchant: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  category: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'raw_data',
    type: 'jsonb',
  })
  rawData: Record<string, unknown>;

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