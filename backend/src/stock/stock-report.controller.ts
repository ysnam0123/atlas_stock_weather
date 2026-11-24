import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { StockReportService } from './stock-report.service.js';

@Controller('stocks/:symbol/report')
export class StockReportController {
  constructor(private readonly reports: StockReportService) {}

  /** 가장 최근 깊게 분석 (없으면 null) */
  @Get()
  latest(@Param('symbol') symbol: string) {
    return this.reports.latest(symbol.toUpperCase());
  }

  /** 깊게 분석 시작. 1~3분 걸려서 기다리지 않는다. web: true면 웹 검색 포함 (토큰 많이 씀) */
  @Post()
  @HttpCode(202)
  start(@Param('symbol') symbol: string, @Body() body: { web?: boolean } = {}) {
    return this.reports.start(symbol.toUpperCase(), body?.web === true);
  }
}
