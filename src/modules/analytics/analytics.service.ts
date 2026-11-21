import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../entities/transaction.entity';

import { randomUUID } from 'node:crypto';

import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { TransactionAnalysis } from '../../entities/transaction-analysis.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue.constants';
import { Queue } from 'bullmq';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { AnalysisStatus } from '../../utils/enums/analysis.enum';
import { GetAnalysisHistoryDto } from './dto/get-analysis-history.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    @InjectRepository(TransactionAnalysis)
    private readonly transactionAnalysisRepository: Repository<TransactionAnalysis>,

    @InjectQueue(QUEUE_NAMES.TRANSACTION_ANALYSIS)
    private readonly analysisQueue: Queue,
  ) {}

  private applyFilters(
    queryBuilder: ReturnType<
      Repository<Transaction>['createQueryBuilder']
    >,
    filters: AnalyticsQueryDto,
  ) {
    if (filters.startDate) {
      queryBuilder.andWhere(
        'transaction.transactionDate >= :startDate',
        {
          startDate: filters.startDate,
        },
      );
    }

    if (filters.endDate) {
      queryBuilder.andWhere(
        'transaction.transactionDate <= :endDate',
        {
          endDate: filters.endDate,
        },
      );
    }

    if (filters.currency) {
      queryBuilder.andWhere(
        'transaction.currency = :currency',
        {
          currency: filters.currency.toUpperCase(),
        },
      );
    }

    if (filters.importBatchId) {
      queryBuilder.andWhere(
        'transaction.importBatchId = :importBatchId',
        {
          importBatchId: filters.importBatchId,
        },
      );
    }

    return queryBuilder;
  }

  async getOverview(
    filters: AnalyticsQueryDto,
  ) {
    const queryBuilder =
      this.transactionRepository
        .createQueryBuilder('transaction');

    this.applyFilters(
      queryBuilder,
      filters,
    );

    const result =
      await queryBuilder
        .select('transaction.currency', 'currency')

        .addSelect(
          `
          COALESCE(
            SUM(
              CASE
                WHEN transaction.transactionType = 'INCOME'
                THEN transaction.amount
                ELSE 0
              END
            ),
            0
          )
          `,
          'totalIncome',
        )

        .addSelect(
          `
          COALESCE(
            SUM(
              CASE
                WHEN transaction.transactionType = 'EXPENSE'
                THEN transaction.amount
                ELSE 0
              END
            ),
            0
          )
          `,
          'totalExpenses',
        )

        .addSelect(
          `
          COALESCE(
            SUM(
              CASE
                WHEN transaction.transactionType = 'INCOME'
                THEN transaction.amount

                WHEN transaction.transactionType = 'EXPENSE'
                THEN -transaction.amount

                ELSE 0
              END
            ),
            0
          )
          `,
          'netBalance',
        )

        .addSelect(
          'COUNT(transaction.id)',
          'transactionCount',
        )

        .addSelect(
          `
          COALESCE(
            AVG(
              CASE
                WHEN transaction.transaction_type IN ('INCOME', 'EXPENSE')
                THEN transaction.amount
              END
            ),
            0
          )
          `,
          'averageTransactionAmount',
        )

        .groupBy('transaction.currency')
        .getRawMany();

    return {
      filters: {
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        currency: filters.currency ?? null,
        importBatchId:
          filters.importBatchId ?? null,
      },

      currencies: result.map((row) => ({
        currency: row.currency,
        totalIncome: row.totalIncome,
        totalExpenses: row.totalExpenses,
        netBalance: row.netBalance,
        transactionCount: Number(
          row.transactionCount,
        ),
        averageTransactionAmount:
          row.averageTransactionAmount,
      })),
    };
  }

  async create(dto: CreateAnalysisDto) {
    const analysis = this.transactionAnalysisRepository.create({
      id: randomUUID(),
      analysisType: dto.analysisType,
      status: AnalysisStatus.PENDING,

      parameters: {
        startDate: dto.startDate,
        endDate: dto.endDate,
        currency: dto.currency?.toUpperCase(),
        importBatchId: dto.importBatchId,
      },
    });

    const savedAnalysis =
      await this.transactionAnalysisRepository.save(analysis);

    await this.transactionAnalysisRepository.update(
      savedAnalysis.id,
      {
        status: AnalysisStatus.QUEUED,
      },
    );

    try {
      await this.analysisQueue.add(
        'run-analysis',
        {
          analysisId: savedAnalysis.id,
        },
        {
          jobId: savedAnalysis.id,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 86400,
            count: 1000,
          },
          removeOnFail: false,
        },
      );

      return {
        id: savedAnalysis.id,
        analysisType: savedAnalysis.analysisType,
        status: AnalysisStatus.QUEUED,
        createdAt: savedAnalysis.createdAt,
      };
    } catch (error) {
      await this.transactionAnalysisRepository.update(
        savedAnalysis.id,
        {
          status: AnalysisStatus.FAILED,
          errorMessage:
            'Failed to enqueue analysis job',
        },
      );

      throw new InternalServerErrorException(
        'Failed to queue analysis',
      );
    }
  }

  async getAnalysisHistory(query: GetAnalysisHistoryDto) {
    const {
      page = 1,
      limit = 10,
      status,
      analysisType,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'startedAt',
      'completedAt',
      'status',
      'analysisType',
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const queryBuilder = this.transactionAnalysisRepository
      .createQueryBuilder('analysis');

    if (status) {
      queryBuilder.andWhere('analysis.status = :status', {
        status,
      });
    }

    if (analysisType) {
      queryBuilder.andWhere('analysis.analysisType = :analysisType', {
        analysisType,
      });
    }

    queryBuilder
      .orderBy(`analysis.${safeSortBy}`, safeSortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: data.map((analysis) => ({
        id: analysis.id,
        analysisType: analysis.analysisType,
        status: analysis.status,
        parameters: analysis.parameters,
        summary:
          analysis.result?.summary ?? null,
        errorMessage:
          analysis.status === AnalysisStatus.FAILED
            ? analysis.errorMessage
            : null,
        retryCount: analysis.retryCount,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAnalysisById(id: string) {
    const analysis = await this.transactionAnalysisRepository.findOne({
      where: { id },
    });

    if (!analysis) {
      throw new NotFoundException(
        `Analysis with ID ${id} not found`,
      );
    }

    return analysis;
  }

  async getAnalysisStatus(id: string) {
    const analysis = await this.transactionAnalysisRepository.findOne({
      where: { id },
      select: {
        id: true,
        analysisType: true,
        status: true,
        retryCount: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException(
        `Analysis with ID ${id} not found`,
      );
    }

    return analysis;
  }
}