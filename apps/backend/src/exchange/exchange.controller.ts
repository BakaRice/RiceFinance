import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ExchangeService } from './exchange.service';
import { ExchangeRateResponse, SetRateRequest } from './exchange.dto';

@ApiTags('Exchange')
@Controller('exchange')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private exchangeService: ExchangeService) {}

  @Get('rates')
  getRates(
    @Query('base') base?: string,
    @Query('date') date?: string,
  ): Promise<ExchangeRateResponse[]> {
    return this.exchangeService.getRates(base, date);
  }

  @Post('rates')
  setRate(@Body() req: SetRateRequest): Promise<ExchangeRateResponse> {
    return this.exchangeService.setRate(req);
  }
}
