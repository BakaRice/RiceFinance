import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { ReportsModule } from './reports/reports.module';
import { ExchangeModule } from './exchange/exchange.module';
import { StatsModule } from './stats/stats.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    FinanceModule,
    SnapshotsModule,
    ReportsModule,
    ExchangeModule,
    StatsModule,
    AiModule,
  ],
})
export class AppModule {}
