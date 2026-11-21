import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from '../../entities/transaction.entity';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TransactionAnalysis } from '../../entities/transaction-analysis.entity';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue.constants';
import { AnalysisDatasetService } from './services/analytics-dataset.service';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionAnalysis,
    ]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.TRANSACTION_ANALYSIS,
    }),

    AiModule,
  ],
  controllers: [
    AnalyticsController,
  ],
  providers: [
    AnalyticsService,
    AnalysisDatasetService,
    AnalyticsProcessor,
  ],
})
export class AnalyticsModule {}