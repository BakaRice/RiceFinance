import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DeepSeekClient } from './deepseek.client';

@Module({
  controllers: [AiController],
  providers: [AiService, DeepSeekClient],
  exports: [AiService],
})
export class AiModule {}
