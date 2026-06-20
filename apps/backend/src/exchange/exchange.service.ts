import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import { ExchangeRateResponse, SetRateRequest } from './exchange.dto';

@Injectable()
export class ExchangeService {
  constructor(private prisma: PrismaService) {}

  async getRates(base?: string, date?: string): Promise<ExchangeRateResponse[]> {
    const where: any = {};
    if (base) where.baseCurrency = base;
    if (date) where.rateDate = new Date(date);

    const rates = await this.prisma.exchangeRate.findMany({
      where,
      orderBy: { rateDate: 'desc' },
    });
    return rates.map(r => ({
      id: r.id, baseCurrency: r.baseCurrency, targetCurrency: r.targetCurrency,
      rate: r.rate.toString(),
      rateDate: r.rateDate.toISOString().split('T')[0],
      source: r.source,
    }));
  }

  async setRate(req: SetRateRequest): Promise<ExchangeRateResponse> {
    const rate = await this.prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency_rateDate: {
          baseCurrency: req.baseCurrency,
          targetCurrency: req.targetCurrency,
          rateDate: new Date(req.rateDate),
        },
      },
      create: {
        baseCurrency: req.baseCurrency,
        targetCurrency: req.targetCurrency,
        rate: new Decimal(req.rate),
        rateDate: new Date(req.rateDate),
        source: 'manual',
      },
      update: {
        rate: new Decimal(req.rate),
      },
    });
    return {
      id: rate.id, baseCurrency: rate.baseCurrency, targetCurrency: rate.targetCurrency,
      rate: rate.rate.toString(),
      rateDate: rate.rateDate.toISOString().split('T')[0],
      source: rate.source,
    };
  }
}
