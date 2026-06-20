import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRateResponse {
  @ApiProperty() id: string;
  @ApiProperty() baseCurrency: string;
  @ApiProperty() targetCurrency: string;
  @ApiProperty() rate: string;
  @ApiProperty() rateDate: string;
  @ApiProperty() source: string;
}

export class SetRateRequest {
  @ApiProperty() @IsString() baseCurrency: string;
  @ApiProperty() @IsString() targetCurrency: string;
  @ApiProperty() @IsString() rate: string;
  @ApiProperty() @IsDateString() rateDate: string;
}
