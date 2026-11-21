import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { QUEUE_NAMES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          db: configService.get<number>('redis.db', 0),

          maxRetriesPerRequest: null,
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.TRANSACTION_IMPORT,
      },
      {
        name: QUEUE_NAMES.TRANSACTION_ANALYSIS,
      }
    ),
  ],

  exports: [BullModule],
})
export class QueuesModule {}