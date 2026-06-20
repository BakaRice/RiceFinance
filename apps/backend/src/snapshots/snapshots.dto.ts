import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSnapshotRequest {
  @ApiProperty() @IsString() clientUid: string;
  @ApiProperty() @IsDateString() snapshotDate: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
}

export class SnapshotResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() snapshotDate: string;
  @ApiProperty() totalAssets: string;
  @ApiProperty() totalLiabilities: string;
  @ApiProperty() netWorth: string;
  @ApiProperty() currency: string;
  @ApiProperty() note?: string;
  @ApiProperty() clientUpdatedAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() version: number;
  @ApiProperty({ required: false }) items?: SnapshotItemResponse[];
}

export class SnapshotItemResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() sourceName: string;
  @ApiProperty() amount: string;
  @ApiProperty() category?: string;
  @ApiProperty() risk?: string;
  @ApiProperty() liquidity?: string;
  @ApiProperty() isLiability: boolean;
}
