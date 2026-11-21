import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Transaction } from '../../../entities/transaction.entity';

export interface AnalysisDatasetParameters {
  startDate?: string;
  endDate?: string;
  currency?: string;
  importBatchId?: string;
}

@Injectable()
export class AnalysisDatasetService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private createFilteredQuery(
    parameters: AnalysisDatasetParameters,
  ) {
    const queryBuilder =
      this.transactionRepository.createQueryBuilder('transaction');

    if (parameters.startDate) {
      queryBuilder.andWhere(
        'transaction.transaction_date >= :startDate',
        {
          startDate: parameters.startDate,
        },
      );
    }

    if (parameters.endDate) {
      queryBuilder.andWhere(
        'transaction.transaction_date <= :endDate',
        {
          endDate: parameters.endDate,
        },
      );
    }

    if (parameters.currency) {
      queryBuilder.andWhere(
        'transaction.currency = :currency',
        {
          currency: parameters.currency.toUpperCase(),
        },
      );
    }

    if (parameters.importBatchId) {
      queryBuilder.andWhere(
        'transaction.import_batch_id = :importBatchId',
        {
          importBatchId: parameters.importBatchId,
        },
      );
    }

    return queryBuilder;
  }

  async buildDataset(
    parameters: AnalysisDatasetParameters,
  ) {
    const overview = await this.getOverview(parameters);

    const categories = await this.getCategoryBreakdown(
      parameters,
    );

    const merchants = await this.getMerchantBreakdown(
      parameters,
    );

    const trends = await this.getMonthlyTrends(
      parameters,
    );

    const largestExpenses = await this.getLargestExpenses(
      parameters,
    );

    return {
      period: {
        startDate: parameters.startDate ?? null,
        endDate: parameters.endDate ?? null,
      },

      filters: {
        currency: parameters.currency?.toUpperCase() ?? null,
        importBatchId: parameters.importBatchId ?? null,
      },

      overview,

      categories,

      merchants,

      trends,

      largestExpenses,
    };
  }

  private async getOverview(
    parameters: AnalysisDatasetParameters,
  ) {
    const query = this.createFilteredQuery(parameters);

    const rows = await query
      .select('transaction.currency', 'currency')

      .addSelect(
        `
        SUM(
          CASE
            WHEN transaction.transaction_type = 'INCOME'
            THEN transaction.amount
            ELSE 0
          END
        )
        `,
        'income',
      )

      .addSelect(
        `
        SUM(
          CASE
            WHEN transaction.transaction_type = 'EXPENSE'
            THEN transaction.amount
            ELSE 0
          END
        )
        `,
        'expenses',
      )

      .addSelect(
        `
        SUM(
          CASE
            WHEN transaction.transaction_type = 'INCOME'
            THEN transaction.amount

            WHEN transaction.transaction_type = 'EXPENSE'
            THEN -transaction.amount

            ELSE 0
          END
        )
        `,
        'netBalance',
      )

      .addSelect(
        'COUNT(*)',
        'transactionCount',
      )

      .addSelect(
        `
        AVG(
          CASE
            WHEN transaction.transaction_type = 'EXPENSE'
            THEN transaction.amount
          END
        )
        `,
        'averageExpense',
      )

      .groupBy('transaction.currency')
      .getRawMany();

    return rows.map((row) => ({
      currency: row.currency,
      income: row.income ?? '0',
      expenses: row.expenses ?? '0',
      netBalance: row.netBalance ?? '0',
      transactionCount: Number(row.transactionCount),
      averageExpense: row.averageExpense ?? '0',
    }));
  }

  private async getCategoryBreakdown(
    parameters: AnalysisDatasetParameters,
  ) {
    const query = this.createFilteredQuery(parameters);

    const rows = await query
      .select('transaction.currency', 'currency')
      .addSelect('transaction.category', 'category')

      .addSelect(
        'SUM(transaction.amount)',
        'totalAmount',
      )

      .addSelect(
        'COUNT(transaction.id)',
        'transactionCount',
      )

      .where(
        'transaction.transaction_type = :type',
        {
          type: 'EXPENSE',
        },
      )

      .groupBy('transaction.currency')
      .addGroupBy('transaction.category')

      .orderBy('SUM(transaction.amount)', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      currency: row.currency,
      category: row.category ?? 'Uncategorized',
      totalAmount: row.totalAmount,
      transactionCount: Number(row.transactionCount),
    }));
  }

  private async getMerchantBreakdown(
    parameters: AnalysisDatasetParameters,
  ) {
    const query = this.createFilteredQuery(parameters);

    const rows = await query
      .select('transaction.currency', 'currency')
      .addSelect('transaction.merchant', 'merchant')

      .addSelect(
        'SUM(transaction.amount)',
        'totalAmount',
      )

      .addSelect(
        'COUNT(transaction.id)',
        'transactionCount',
      )

      .where(
        'transaction.transaction_type = :type',
        {
          type: 'EXPENSE',
        },
      )

      .andWhere(
        'transaction.merchant IS NOT NULL',
      )

      .groupBy('transaction.currency')
      .addGroupBy('transaction.merchant')

      .orderBy('SUM(transaction.amount)', 'DESC')
      .limit(20)
      .getRawMany();

    return rows.map((row) => ({
      currency: row.currency,
      merchant: row.merchant,
      totalAmount: row.totalAmount,
      transactionCount: Number(row.transactionCount),
    }));
  }

  private async getMonthlyTrends(
    parameters: AnalysisDatasetParameters,
  ) {
    const query = this.createFilteredQuery(parameters);

    const rows = await query
      .select(
        `
        DATE_TRUNC(
          'month',
          transaction.transaction_date
        )
        `,
        'month',
      )

      .addSelect(
        'transaction.currency',
        'currency',
      )

      .addSelect(
        `
        SUM(
          CASE
            WHEN transaction.transaction_type = 'INCOME'
            THEN transaction.amount
            ELSE 0
          END
        )
        `,
        'income',
      )

      .addSelect(
        `
        SUM(
          CASE
            WHEN transaction.transaction_type = 'EXPENSE'
            THEN transaction.amount
            ELSE 0
          END
        )
        `,
        'expenses',
      )

      .groupBy('month')
      .addGroupBy('transaction.currency')

      .orderBy('month', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      month: row.month,
      currency: row.currency,
      income: row.income ?? '0',
      expenses: row.expenses ?? '0',
    }));
  }

  private async getLargestExpenses(
    parameters: AnalysisDatasetParameters,
  ) {
    const query = this.createFilteredQuery(parameters);

    const rows = await query
      .select([
        'transaction.id',
        'transaction.externalTransactionId',
        'transaction.transactionDate',
        'transaction.amount',
        'transaction.currency',
        'transaction.merchant',
        'transaction.category',
        'transaction.description',
      ])

      .where(
        'transaction.transactionType = :type',
        {
          type: 'EXPENSE',
        },
      )

      .orderBy(
        'transaction.amount',
        'DESC',
      )

      .limit(10)
      .getMany();

    return rows.map((transaction) => ({
      id: transaction.id,
      externalTransactionId:
        transaction.externalTransactionId,
      date: transaction.transactionDate,
      amount: transaction.amount,
      currency: transaction.currency,
      merchant: transaction.merchant,
      category: transaction.category,
      description: transaction.description,
    }));
  }
}