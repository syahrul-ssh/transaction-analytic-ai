import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Transaction } from '../../entities/transaction.entity';

import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
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
                WHEN transaction.transactionType IN ('INCOME', 'EXPENSE')
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
}