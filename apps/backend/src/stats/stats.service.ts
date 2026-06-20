import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import { OverviewResponse, CurrencyBreakdown, AccountBreakdown } from './stats.dto';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async overview(userId: string): Promise<OverviewResponse> {
    const assets = await this.prisma.assetAccount.findMany({
      where: { userId, deletedAt: null },
    });
    const liabilities = await this.prisma.liabilityAccount.findMany({
      where: { userId, deletedAt: null },
    });

    const totalAssets = assets.reduce((s, a) => s.plus(a.amount), new Decimal(0));
    const totalLiabilities = liabilities.reduce((s, l) => s.plus(l.amount), new Decimal(0));
    const netWorth = totalAssets.minus(totalLiabilities);

    // Group by currency
    const assetCurrencyMap = new Map<string, Decimal>();
    for (const a of assets) {
      const curr = a.currency || 'CNY';
      assetCurrencyMap.set(curr, (assetCurrencyMap.get(curr) || new Decimal(0)).plus(a.amount));
    }

    const liabilityCurrencyMap = new Map<string, Decimal>();
    for (const l of liabilities) {
      const curr = l.currency || 'CNY';
      liabilityCurrencyMap.set(curr, (liabilityCurrencyMap.get(curr) || new Decimal(0)).plus(l.amount));
    }

    const assetsByCurrency: CurrencyBreakdown[] = Array.from(assetCurrencyMap.entries()).map(([currency, amount]) => ({
      currency, originalAmount: amount.toString(),
    }));

    const liabilitiesByCurrency: CurrencyBreakdown[] = Array.from(liabilityCurrencyMap.entries()).map(([currency, amount]) => ({
      currency, originalAmount: amount.toString(),
    }));

    // Top 5 by amount
    const topAssets: AccountBreakdown[] = assets
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .slice(0, 5)
      .map(a => ({ clientUid: a.clientUid, name: a.name, currency: a.currency, originalAmount: a.amount.toString() }));

    const topLiabilities: AccountBreakdown[] = liabilities
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .slice(0, 5)
      .map(l => ({ clientUid: l.clientUid, name: l.name, currency: l.currency, originalAmount: l.amount.toString() }));

    // Get base currency from user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return {
      baseCurrency: user?.baseCurrency || 'CNY',
      totalAssets: totalAssets.toString(),
      totalLiabilities: totalLiabilities.toString(),
      netWorth: netWorth.toString(),
      assetsByCurrency,
      liabilitiesByCurrency,
      topAssets,
      topLiabilities,
    };
  }
}
