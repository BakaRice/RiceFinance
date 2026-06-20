import { ApiProperty } from '@nestjs/swagger';

export class CurrencyBreakdown {
  @ApiProperty() currency: string;
  @ApiProperty() originalAmount: string;
  @ApiProperty() convertedAmount?: string;
  @ApiProperty() rate?: string;
}

export class AccountBreakdown {
  @ApiProperty() clientUid: string;
  @ApiProperty() name: string;
  @ApiProperty() currency: string;
  @ApiProperty() originalAmount: string;
}

export class OverviewResponse {
  @ApiProperty() baseCurrency: string;
  @ApiProperty() totalAssets: string;
  @ApiProperty() totalLiabilities: string;
  @ApiProperty() netWorth: string;
  @ApiProperty() assetsByCurrency: CurrencyBreakdown[];
  @ApiProperty() liabilitiesByCurrency: CurrencyBreakdown[];
  @ApiProperty() topAssets: AccountBreakdown[];
  @ApiProperty() topLiabilities: AccountBreakdown[];
}
