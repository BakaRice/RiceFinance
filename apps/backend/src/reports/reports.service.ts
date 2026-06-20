import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReportResponse } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string): Promise<ReportResponse[]> {
    const reports = await this.prisma.report.findMany({
      where: { userId, deletedAt: null },
      orderBy: { generatedAt: 'desc' },
    });
    return reports.map(r => ({
      id: r.id, clientUid: r.clientUid, title: r.title,
      reportType: r.reportType, markdown: r.markdown,
      summaryJson: r.summaryJson,
      generatedAt: r.generatedAt.toISOString(),
    }));
  }

  async getLatestAiReview(userId: string): Promise<ReportResponse | null> {
    const report = await this.prisma.report.findFirst({
      where: { userId, reportType: 'ai_review', deletedAt: null },
      orderBy: { generatedAt: 'desc' },
    });
    if (!report) return null;
    return {
      id: report.id, clientUid: report.clientUid, title: report.title,
      reportType: report.reportType, markdown: report.markdown,
      summaryJson: report.summaryJson,
      generatedAt: report.generatedAt.toISOString(),
    };
  }
}
