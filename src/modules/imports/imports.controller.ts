import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { ImportsService } from './imports.service';

import { ListImportsQueryDto } from './dto/list-imports-query.dto';
import { ListImportErrorsQueryDto } from './dto/list-import-errors-query.dto';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ) {
    const batch =
      await this.importsService.createImport(file);

    return {
      message: 'Import queued successfully',
      data: {
        id: batch.id,
        filename: batch.originalFilename,
        status: batch.status,
        createdAt: batch.createdAt,
      },
    };
  }

  @Get()
  async findAll(
    @Query() query: ListImportsQueryDto,
  ) {
    return this.importsService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ) {
    return this.importsService.findOne(id);
  }

  @Get(':id/errors')
  async findErrors(
    @Param('id') id: string,
    @Query() query: ListImportErrorsQueryDto,
  ) {
    return this.importsService.findErrors(
      id,
      query,
    );
  }
}