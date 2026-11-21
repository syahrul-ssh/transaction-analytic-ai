import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import databaseConfig from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmConfig } from './config/typeorm.config';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from 'nestjs-pino';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueuesModule } from './infrastructure/queues/queue.module';
import storageConfig from './config/storage.config';
import { ImportsModule } from './modules/imports/imports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        storageConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
              }
            : undefined,
      },
    }),
    RedisModule,
    QueuesModule,
    ImportsModule,
    AnalyticsModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
