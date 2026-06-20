import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService } from './ai.service';
import { AIReviewResponse } from './ai.dto';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('reviews')
  generateReview(@CurrentUser() user: any): Promise<AIReviewResponse> {
    return this.aiService.generateReview(user.userId);
  }
}
