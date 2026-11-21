import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';

import {
  Repository,
  FindOptionsWhere,
} from 'typeorm';

import { Queue } from 'bullmq';

import { randomUUID } from 'node:crypto';

import { QUEUE_NAMES } from '../../infrastructure/queues/queue.constants';

import { ListImportsQueryDto } from './dto/list-imports-query.dto';
import { ListImportErrorsQueryDto } from './dto/list-import-errors-query.dto';
import { ImportBatch } from '../../entities/import-batch.entity';
import { ImportError } from '../../entities/import-error.entity';
import { ImportStatus } from '../../utils/enums/import-status.enum';

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepository: Repository<ImportBatch>,

    @InjectRepository(ImportError)
    private readonly importErrorRepository: Repository<ImportError>,

    @InjectQueue(QUEUE_NAMES.TRANSACTION_IMPORT)
    private readonly importQueue: Queue,
  ) {}

  async createImport(
    file: Express.Multer.File,
  ): Promise<ImportBatch> {
    if (!file) {
      throw new BadRequestException(
        'CSV file is required',
      );
    }

    const batch = this.importBatchRepository.create({
      id: randomUUID(),
      originalFilename: file.originalname,
      storageFilename: file.filename,
      filePath: file.path,
      fileSize: String(file.size),
      status: ImportStatus.QUEUED,
    });

    await this.importBatchRepository.save(batch);

    try {
      await this.importQueue.add(
        'process-transaction-import',
        {
          importBatchId: batch.id,
          filePath: batch.filePath,
        },
        {
          jobId: batch.id,

          attempts: 3,

          backoff: {
            type: 'exponential',
            delay: 1000,
          },

          removeOnComplete: {
            age: 3600,
          },

          removeOnFail: false,
        },
      );
    } catch (error) {
      batch.status = ImportStatus.FAILED;
      batch.errorMessage =
        'Failed to enqueue import job';

      await this.importBatchRepository.save(batch);

      throw new InternalServerErrorException(
        'Unable to queue file import',
      );
    }

    return batch;
  }

  async findAll(
    query: ListImportsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: FindOptionsWhere<ImportBatch> = {};

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] =
      await this.importBatchRepository.findAndCount({
        where,

        order: {
          createdAt: 'DESC',
        },

        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    importBatchId: string,
  ): Promise<ImportBatch> {
    const batch =
      await this.importBatchRepository.findOne({
        where: {
          id: importBatchId,
        },
      });

    if (!batch) {
      throw new NotFoundException(
        'Import batch not found',
      );
    }

    return batch;
  }

  async findErrors(
    importBatchId: string,
    query: ListImportErrorsQueryDto,
  ) {
    await this.findOne(importBatchId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    const [items, total] =
      await this.importErrorRepository.findAndCount({
        where: {
          importBatchId,
        },

        order: {
          rowNumber: 'ASC',
        },

        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}