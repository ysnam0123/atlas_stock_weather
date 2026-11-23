import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { type HoldingInput, MyService } from './my.service.js';

const norm = (symbol: string) => symbol.trim().toUpperCase();

@Controller()
export class MyController {
  constructor(private readonly my: MyService) {}

  @Get('symbols/search')
  search(@Query('q') q = '') {
    return this.my.search(q);
  }

  @Get('settings')
  async settings() {
    return { capital: await this.my.capital() };
  }

  @Put('settings')
  saveSettings(@Body() body: { capital?: number | null }) {
    return this.my.setCapital(body.capital);
  }

  @Get('my')
  list() {
    return this.my.my();
  }

  @Post('watchlist')
  addWatch(@Body() body: { symbol: string; note?: string | null }) {
    return this.my.addWatch(norm(body.symbol ?? ''), body.note);
  }

  @Delete('watchlist/:symbol')
  removeWatch(@Param('symbol') symbol: string) {
    return this.my.removeWatch(norm(symbol));
  }

  @Put('holdings/:symbol')
  saveHolding(@Param('symbol') symbol: string, @Body() body: HoldingInput) {
    return this.my.saveHolding(norm(symbol), body);
  }

  @Delete('holdings/:symbol')
  removeHolding(@Param('symbol') symbol: string) {
    return this.my.removeHolding(norm(symbol));
  }

  @Get('trades')
  trades() {
    return this.my.trades();
  }

  @Post('trades')
  addTrade(
    @Body() body: { symbol: string; side: string; date: string; price: number; shares: number; note?: string | null },
  ) {
    return this.my.addTrade({ ...body, symbol: norm(body.symbol ?? '') });
  }

  @Delete('trades/:id')
  deleteTrade(@Param('id') id: string) {
    return this.my.deleteTrade(id);
  }

  @Get('holdings/:symbol/stop-options')
  stopOptions(@Param('symbol') symbol: string, @Query('avgCost') avgCost: string, @Query('shares') shares?: string) {
    return this.my.stopOptions(norm(symbol), avgCost, shares);
  }
}
