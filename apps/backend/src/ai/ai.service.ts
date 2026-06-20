import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { DeepSeekClient } from './deepseek.client';
import { AIReviewResponse } from './ai.dto';

const SYSTEM_PROMPT = `You are a personal financial analyst. Review the user's financial data and provide insights in JSON format.

Output JSON structure:
{
  "summary": "one-paragraph overview",
  "highlights": ["highlight 1", "highlight 2", ...],
  "risks": ["risk 1", "risk 2", ...],
  "nextActions": ["action 1", "action 2", ...],
  "disclaimer": "This is not financial advice."
}`;

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private deepseek: DeepSeekClient,
  ) {}

  async generateReview(userId: string): Promise<AIReviewResponse> {
    const assets = await this.prisma.assetAccount.findMany({
      where: { userId, deletedAt: null },
    });
    const liabilities = await this.prisma.liabilityAccount.findMany({
      where: { userId, deletedAt: null },
    });
    const snapshots = await this.prisma.netWorthSnapshot.findMany({
      where: { userId, deletedAt: null },
      orderBy: { snapshotDate: 'desc' },
      take: 6,
    });

    if (assets.length === 0 && liabilities.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'No financial data to review');
    }

    const context = {
      assets: assets.map(a => ({
        name: a.name, type: a.type, currency: a.currency,
        amount: a.amount.toString(), risk: a.risk, liquidity: a.liquidity,
      })),
      liabilities: liabilities.map(l => ({
        name: l.name, type: l.type, currency: l.currency,
        amount: l.amount.toString(),
      })),
      recentSnapshots: snapshots.map(s => ({
        date: s.snapshotDate.toISOString().split('T')[0],
        netWorth: s.netWorth.toString(),
        totalAssets: s.totalAssets.toString(),
        totalLiabilities: s.totalLiabilities.toString(),
      })),
    };

    const content = await this.deepseek.chat(SYSTEM_PROMPT, JSON.stringify(context, null, 2));

    let review: any;
    try {
      review = JSON.parse(content);
    } catch {
      // Fallback: wrap raw content
      review = {
        summary: content.slice(0, 500),
        highlights: [],
        risks: [],
        nextActions: [],
        disclaimer: 'This is not financial advice.',
      };
    }

    // Save as report
    const clientUid = uuid();
    const now = new Date();
    await this.prisma.report.create({
      data: {
        userId,
        clientUid,
        title: `AI Review - ${now.toISOString().split('T')[0]}`,
        reportType: 'ai_review',
        markdown: this.buildMarkdown(review),
        summaryJson: review,
        generatedAt: now,
        clientUpdatedAt: now,
      },
    });

    return {
      clientUid,
      summary: review.summary || '',
      highlights: review.highlights || [],
      risks: review.risks || [],
      nextActions: review.nextActions || [],
      disclaimer: review.disclaimer || 'This is not financial advice.',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      generatedAt: now.toISOString(),
    };
  }

  private buildMarkdown(review: any): string {
    let md = `## Summary\n\n${review.summary || ''}\n\n`;
    if (review.highlights?.length) {
      md += `## Highlights\n\n${review.highlights.map((h: string) => `- ${h}`).join('\n')}\n\n`;
    }
    if (review.risks?.length) {
      md += `## Risks\n\n${review.risks.map((r: string) => `- ${r}`).join('\n')}\n\n`;
    }
    if (review.nextActions?.length) {
      md += `## Next Actions\n\n${review.nextActions.map((a: string) => `- ${a}`).join('\n')}\n\n`;
    }
    md += `---\n*${review.disclaimer || 'This is not financial advice.'}*`;
    return md;
  }
}
