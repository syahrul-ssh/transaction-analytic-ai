import { Injectable } from '@nestjs/common';
import { TransactionType } from '../../../utils/enums/transaction-type.enum';

export interface ParsedTransactionRow {
  externalTransactionId: string;
  transactionDate: string;
  amount: string;
  currency: string;
  transactionType: TransactionType;
  merchant: string | null;
  category: string | null;
  description: string | null;
  rawData: Record<string, unknown>;
}

export interface RowValidationError {
  code: string;
  message: string;
}

export interface RowParseResult {
  data?: ParsedTransactionRow;
  error?: RowValidationError;
}

@Injectable()
export class TransactionRowParserService {
  parse(
    row: Record<string, unknown>,
  ): RowParseResult {
    const transactionId = this.getString(
      row.transaction_id,
    );

    if (!transactionId) {
      return this.fail(
        'MISSING_TRANSACTION_ID',
        'transaction_id is required',
      );
    }

    const date = this.getString(row.date);

    if (!date || !this.isValidDate(date)) {
      return this.fail(
        'INVALID_TRANSACTION_DATE',
        'date must be a valid YYYY-MM-DD date',
      );
    }

    const amount = this.getString(row.amount);

    if (!amount || !this.isValidAmount(amount)) {
      return this.fail(
        'INVALID_AMOUNT',
        'amount must be a positive decimal number',
      );
    }

    const currency = this.getString(row.currency)?.toUpperCase();

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      return this.fail(
        'INVALID_CURRENCY',
        'currency must be a 3-character currency code',
      );
    }

    const transactionType =
      this.getString(row.type)?.toUpperCase();

    if (
      !transactionType ||
      !Object.values(TransactionType).includes(
        transactionType as TransactionType,
      )
    ) {
      return this.fail(
        'INVALID_TRANSACTION_TYPE',
        'type must be INCOME, EXPENSE, or TRANSFER',
      );
    }

    return {
      data: {
        externalTransactionId: transactionId,
        transactionDate: date,
        amount,
        currency,
        transactionType:
          transactionType as TransactionType,
        merchant: this.getString(row.merchant) ?? null,
        category: this.getString(row.category) ?? null,
        description: this.getString(row.description) ?? null,
        rawData: row,
      },
    };
  }

  private getString(
    value: unknown,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const result = String(value).trim();

    return result.length > 0 ? result : undefined;
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  private isValidAmount(value: string): boolean {
    if (!/^\d+(\.\d{1,4})?$/.test(value)) {
      return false;
    }

    const [integerPart, decimalPart = ''] =
      value.split('.');

    if (integerPart.length > 16) {
      return false;
    }

    if (decimalPart.length > 4) {
      return false;
    }

    return !/^0+(\.0+)?$/.test(value);
  }

  private fail(
    code: string,
    message: string,
  ): RowParseResult {
    return {
      error: {
        code,
        message,
      },
    };
  }
}