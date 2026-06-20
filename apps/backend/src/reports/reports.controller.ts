import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';
import { ReportResponse } from './reports.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  list(@CurrentUser() user: any): Promise<ReportResponse[]> {
    return this.reportsService.list(user.userId);
  }

  @Get('latest-ai-review')
  async getLatestAiReview(@CurrentUser() user: any): Promise<ReportResponse | null> {
    return this.reportsService.getLatestAiReview(user.userId);
  }
}
