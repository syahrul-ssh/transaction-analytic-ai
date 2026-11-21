import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import { Job } from 'bullmq';

import {
  InjectRepository,
} from '@nestjs/typeorm';

import {
  Repository,
  In,
} from 'typeorm';

import {
  createReadStream,
} from 'node:fs';

import {
  randomUUID,
} from 'node:crypto';

import csv from 'csv-parser';

import {
  TransactionRowParserService,
  ParsedTransactionRow,
} from '../services/transaction-row-parser.service';

import { QUEUE_NAMES } from '../../../infrastructure/queues/queue.constants';
import { ImportBatch } from '../../../entities/import-batch.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { ImportError } from '../../../entities/import-error.entity';
import { ImportStatus } from '../../../utils/enums/import-status.enum';
import { ConfigService } from '@nestjs/config';

interface ImportJobData {
  importBatchId: string;
  filePath: string;
}

interface CsvRow {
  [key: string]: string;
}

interface RowError {
  rowNumber: number;
  rawData: Record<string, unknown>;
  errorCode: string;
  errorMessage: string;
}

@Processor(QUEUE_NAMES.TRANSACTION_IMPORT, {
  concurrency: 1,
})
export class TransactionImportProcessor
  extends WorkerHost
{
  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepository: Repository<ImportBatch>,

    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(ImportError)
    private readonly importErrorRepository: Repository<ImportError>,

    private readonly rowParser: TransactionRowParserService,

    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(
    job: Job<ImportJobData>,
  ): Promise<void> {
    const seenTransactionIds = new Set<string>();

    const {
      importBatchId,
      filePath,
    } = job.data;

    const batch =
      await this.importBatchRepository.findOne({
        where: {
          id: importBatchId,
        },
      });

    if (!batch) {
      throw new Error(
        `Import batch ${importBatchId} not found`,
      );
    }

    batch.status = ImportStatus.PROCESSING;
    batch.startedAt = new Date();
    batch.completedAt = null;
    batch.errorMessage = null;

    batch.totalRows = 0;
    batch.processedRows = 0;
    batch.successfulRows = 0;
    batch.failedRows = 0;
    batch.duplicateRows = 0;

    await this.importBatchRepository.save(batch);

    await this.importErrorRepository.delete({
      importBatchId,
    });

    const batchSize = this.configService.get('storage.importBatchSize', 1000);

    let totalRows = 0;
    let successfulRows = 0;
    let failedRows = 0;
    let duplicateRows = 0;

    let validBatch: ParsedTransactionRow[] = [];
    let errorBatch: RowError[] = [];

    let rowsSinceFlush = 0;

    const flush = async (): Promise<void> => {
      if (
        validBatch.length === 0 &&
        errorBatch.length === 0
      ) {
        return;
      }

      const validRows = validBatch;
      const invalidRows = errorBatch;

      validBatch = [];
      errorBatch = [];

      let batchSuccessfulRows = 0;
      let batchDuplicateRows = 0;

      if (validRows.length > 0) {
        const uniqueRows =
          new Map<string, ParsedTransactionRow>();

        for (const row of validRows) {
          if (
            uniqueRows.has(
              row.externalTransactionId,
            )
          ) {
            batchDuplicateRows++;
            continue;
          }

          uniqueRows.set(
            row.externalTransactionId,
            row,
          );
        }

        const uniqueTransactionIds = [
          ...uniqueRows.keys(),
        ];

        const existingTransactions =
          await this.transactionRepository.find({
            where: {
              externalTransactionId: In(
                uniqueTransactionIds,
              ),
            },

            select: {
              externalTransactionId: true,
              importBatchId: true,
            },
          });

        const existingMap = new Map(
          existingTransactions.map((transaction) => [
            transaction.externalTransactionId,
            transaction.importBatchId,
          ]),
        );

        const insertRows: Transaction[] = [];

        for (const row of uniqueRows.values()) {
          const existingBatchId =
            existingMap.get(
              row.externalTransactionId,
            );

          if (existingBatchId) {
            if (
              existingBatchId === importBatchId
            ) {
              batchSuccessfulRows++;
            } else {
              batchDuplicateRows++;
            }

            continue;
          }

          insertRows.push(
            this.transactionRepository.create({
              id: randomUUID(),
              externalTransactionId:
                row.externalTransactionId,
              importBatchId,
              transactionDate:
                row.transactionDate,
              amount: row.amount,
              currency: row.currency,
              transactionType:
                row.transactionType,
              merchant: row.merchant,
              category: row.category,
              description: row.description,
              rawData: row.rawData,
            }),
          );
        }

        if (insertRows.length > 0) {
          const insertResult =
            await this.transactionRepository
              .createQueryBuilder()
              .insert()
              .into(Transaction)
              .values(insertRows)
              .orIgnore()
              .execute();

          const insertedCount =
            insertResult.identifiers.length;

          batchSuccessfulRows += insertedCount;

          batchDuplicateRows +=
            insertRows.length - insertedCount;
        }
      }

      if (invalidRows.length > 0) {
        const errorEntities =
          invalidRows.map((error) =>
            this.importErrorRepository.create({
              id: randomUUID(),
              importBatchId,
              rowNumber: error.rowNumber,
              rawData: error.rawData,
              errorCode: error.errorCode,
              errorMessage: error.errorMessage,
            }),
          );

        await this.importErrorRepository.insert(
          errorEntities,
        );
      }

      successfulRows += batchSuccessfulRows;
      failedRows += invalidRows.length;
      duplicateRows += batchDuplicateRows;

      const processedRows =
        successfulRows +
        failedRows +
        duplicateRows;

      await this.importBatchRepository.update(
        importBatchId,
        {
          totalRows,
          processedRows,
          successfulRows,
          failedRows,
          duplicateRows,
        },
      );

      await job.updateProgress({
        totalRows,
        processedRows,
        successfulRows,
        failedRows,
        duplicateRows,
      });
    };

    try {
      const fileStream = createReadStream(filePath);

      const csvStream = fileStream.pipe(
        csv({
          strict: true,

          mapHeaders: ({ header }) =>
            header.trim().toLowerCase(),
        }),
      );

      let rowNumber = 1;

      const requiredHeaders = [
        'transaction_id',
        'date',
        'amount',
        'currency',
        'type',
      ];

      let headersValidated = false;

      csvStream.on('headers', (headers: string[]) => {
        const normalizedHeaders = headers.map(
          (header) =>
            header.trim().toLowerCase(),
        );

        const missingHeaders =
          requiredHeaders.filter(
            (header) =>
              !normalizedHeaders.includes(header),
          );

        if (missingHeaders.length > 0) {
          csvStream.destroy(
            new Error(
              `Missing required CSV columns: ${missingHeaders.join(', ')}`,
            ),
          );
        }

        headersValidated = true;
      });

      for await (const rawRow of csvStream) {
        rowNumber++;
        totalRows++;
        rowsSinceFlush++;

        const row = rawRow as CsvRow;

        const result =
          this.rowParser.parse(row);

        if (result.error) {
          errorBatch.push({
            rowNumber,
            rawData: row,
            errorCode: result.error.code,
            errorMessage: result.error.message,
          });
        } else if (result.data) {
          const transactionId =
            result.data.externalTransactionId;

          if (seenTransactionIds.has(transactionId)) {
            errorBatch.push({
              rowNumber,
              rawData: row,
              errorCode: 'DUPLICATE_IN_FILE',
              errorMessage:
                `Duplicate transaction_id "${transactionId}" within the uploaded file`,
            });
          } else {
            seenTransactionIds.add(transactionId);
            validBatch.push(result.data);
          }
        }

        if (rowsSinceFlush >= batchSize) {
          await flush();
          rowsSinceFlush = 0;
        }
      }

      if (!headersValidated) {
        throw new Error(
          'CSV file is missing headers',
        );
      }

      await flush();

      if (totalRows === 0) {
        throw new Error(
          'CSV file contains no transaction records',
        );
      }

      const finalStatus =
        failedRows > 0
          ? ImportStatus.COMPLETED_WITH_ERRORS
          : ImportStatus.COMPLETED;

      await this.importBatchRepository.update(
        importBatchId,
        {
          status: finalStatus,
          totalRows,
          processedRows:
            successfulRows +
            failedRows +
            duplicateRows,
          successfulRows,
          failedRows,
          duplicateRows,
          completedAt: new Date(),
        },
      );
    } catch (error) {
      await this.importBatchRepository.update(
        importBatchId,
        {
          status: ImportStatus.FAILED,
          totalRows,
          processedRows:
            successfulRows +
            failedRows +
            duplicateRows,
          successfulRows,
          failedRows,
          duplicateRows,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Unknown import error',
        },
      );

      throw error;
    }
  }
}