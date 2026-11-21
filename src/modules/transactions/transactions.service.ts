import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {  InjectRepository } from '@nestjs/typeorm';

import {
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { Transaction } from '../../entities/transaction.entity';

import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';

import { paginate } from '../../utils/helper/paginate';
import { TransactionSortField } from '../../utils/enums/transaction-sort-field.enum';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Transaction>,
    filters: ListTransactionsQueryDto,
  ) {
    if (filters.search) {
      const search = `%${filters.search.trim()}%`;

      queryBuilder.andWhere(
        `(
          transaction.externalTransactionId ILIKE :search
          OR transaction.merchant ILIKE :search
          OR transaction.category ILIKE :search
          OR transaction.description ILIKE :search
        )`,
        {
          search,
        },
      );
    }

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

    if (filters.type) {
      queryBuilder.andWhere(
        'transaction.transactionType = :type',
        {
          type: filters.type,
        },
      );
    }

    if (filters.currency) {
      queryBuilder.andWhere(
        'transaction.currency = :currency',
        {
          currency: filters.currency,
        },
      );
    }

    if (filters.category) {
      queryBuilder.andWhere(
        'transaction.category ILIKE :category',
        {
          category: `%${filters.category}%`,
        },
      );
    }

    if (filters.merchant) {
      queryBuilder.andWhere(
        'transaction.merchant ILIKE :merchant',
        {
          merchant: `%${filters.merchant}%`,
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

  async findAll(
    filters: ListTransactionsQueryDto,
  ) {
    const queryBuilder =
      this.transactionRepository
        .createQueryBuilder('transaction');

    this.applyFilters(
      queryBuilder,
      filters,
    );

    const allowedSortFields: Record<
      TransactionSortField,
      string
    > = {
      [TransactionSortField.TRANSACTION_DATE]:
        'transaction.transactionDate',

      [TransactionSortField.AMOUNT]:
        'transaction.amount',

      [TransactionSortField.CREATED_AT]:
        'transaction.createdAt',

      [TransactionSortField.UPDATED_AT]:
        'transaction.updatedAt',

      [TransactionSortField.MERCHANT]:
        'transaction.merchant',

      [TransactionSortField.CATEGORY]:
        'transaction.category',

      [TransactionSortField.EXTERNAL_TRANSACTION_ID]:
        'transaction.externalTransactionId',
    };

    const sortField =
      allowedSortFields[filters.sortBy];

    const sortOrder =
      filters.sortOrder ?? 'DESC';

    const offset =
      (filters.page - 1) * filters.limit;

    queryBuilder
      .orderBy(sortField, sortOrder)
      .addOrderBy('transaction.id', 'DESC')
      .skip(offset)
      .take(filters.limit);

    const [data, total] =
      await queryBuilder.getManyAndCount();

    return paginate(
      data,
      total,
      filters.page,
      filters.limit,
    );
  }

  async findOne(id: string) {
    const transaction =
      await this.transactionRepository.findOne({
        where: {
          id,
        },
      });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID "${id}" not found`,
      );
    }

    return transaction;
  }
}