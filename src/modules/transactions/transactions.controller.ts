import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import {
  TransactionsService,
} from './transactions.service';

import {
  ListTransactionsQueryDto,
} from './dto/list-transactions-query.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  findAll(
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.transactionsService.findOne(id);
  }
}