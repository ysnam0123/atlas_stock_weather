import { Controller, Get } from '@nestjs/common';
import { HomeService } from './home.service.js';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  /** MVP는 미국만. 코스피(Phase 9)가 붙으면 ?market=kr */
  @Get()
  get() {
    return this.home.get('us');
  }
}
