import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StatsService } from './stats.service';
import { OverviewResponse } from './stats.dto';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('overview')
  overview(@CurrentUser() user: any): Promise<OverviewResponse> {
    return this.statsService.overview(user.userId);
  }
}
