import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { QueuesModule } from '../../infrastructure/queues/queue.module';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

import { TransactionRowParserService } from './services/transaction-row-parser.service';

import { TransactionImportProcessor } from './processors/transaction-import.processor';
import { ImportBatch } from '../../entities/import-batch.entity';
import { Transaction } from '../../entities/transaction.entity';
import { ImportError } from '../../entities/import-error.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportBatch,
      Transaction,
      ImportError,
    ]),

    QueuesModule,

    MulterModule.registerAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const uploadDirectory = resolve(
          configService.get<string>(
            'storage.uploadDirectory',
            'uploads/imports',
          ),
        );

        const maxUploadSizeMb =
          configService.get<number>(
            'MAX_UPLOAD_SIZE_MB',
            100,
          );

        return {
          storage: diskStorage({
            destination: (_req, _file, callback) => {
              try {
                mkdirSync(uploadDirectory, {
                  recursive: true,
                });

                callback(null, uploadDirectory);
              } catch (error) {
                callback(error as Error, uploadDirectory);
              }
            },

            filename: (_req, file, callback) => {
              callback(
                null,
                `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
              );
            },
          }),

          limits: {
            fileSize:
              maxUploadSizeMb * 1024 * 1024,
          },

          fileFilter: (_req, file, callback) => {
            const extension = extname(
              file.originalname,
            ).toLowerCase();

            if (extension !== '.csv') {
              return callback(
                new Error('Only CSV files are allowed'),
                false,
              );
            }

            callback(null, true);
          },
        };
      },
    }),
  ],

  controllers: [ImportsController],

  providers: [
    ImportsService,
    TransactionRowParserService,
    TransactionImportProcessor,
  ],

  exports: [ImportsService],
})
export class ImportsModule {}