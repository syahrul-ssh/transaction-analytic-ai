import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { GetAnalysisHistoryDto } from './dto/get-analysis-history.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('overview')
  getOverview(
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOverview(query);
  }

  @Post()
  create(
    @Body() dto: CreateAnalysisDto,
  ) {
    return this.analyticsService.create(dto);
  }

  @Get('analyses')
  getAnalysisHistory(
    @Query() query: GetAnalysisHistoryDto,
  ) {
    return this.analyticsService.getAnalysisHistory(query);
  }

  @Get('analyses/:id/status')
  getAnalysisStatus(
    @Param('id') id: string,
  ) {
    return this.analyticsService.getAnalysisStatus(id);
  }

  @Get('analyses/:id')
  getAnalysisById(
    @Param('id') id: string,
  ) {
    return this.analyticsService.getAnalysisById(id);
  }
}