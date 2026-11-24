import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get()
  duel() {
    return this.ai.duel();
  }

  /** 시작 자금을 정해 AI v1·v2 계좌를 같은 금액으로 새로 연다 (이전 계좌들은 끝난다) */
  @Post('account')
  start(@Body() body: { startCapital: number }) {
    return this.ai.startAccounts(body.startCapital);
  }

  /** 지금 한 번 실행. 스캔에 몇 분 걸려서 기다리지 않는다 */
  @Post('run')
  @HttpCode(202)
  run() {
    return this.ai.trigger();
  }
}
