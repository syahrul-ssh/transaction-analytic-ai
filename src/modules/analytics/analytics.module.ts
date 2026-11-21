import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from '../../entities/transaction.entity';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
    ]),
  ],
  controllers: [
    AnalyticsController,
  ],
  providers: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}