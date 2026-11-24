import { Controller, Get } from '@nestjs/common';
import { SectorsService } from './sectors.service.js';

@Controller('sectors')
export class SectorsController {
  constructor(private readonly sectors: SectorsService) {}

  /** 섹터 지도: 11개 섹터의 상승추세 비율 1년 흐름, 국면, 섹터 ETF 수익률 */
  @Get()
  get() {
    return this.sectors.get();
  }
}
