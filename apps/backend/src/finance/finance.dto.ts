import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssetResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiProperty() platform?: string;
  @ApiProperty() currency: string;
  @ApiProperty() amount: string;
  @ApiProperty() shareCount?: string;
  @ApiProperty() risk: string;
  @ApiProperty() liquidity: string;
  @ApiProperty() note?: string;
  @ApiProperty() clientUpdatedAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty() deletedAt?: string;
  @ApiProperty() version: number;
}

export class LiabilityResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiProperty() currency: string;
  @ApiProperty() amount: string;
  @ApiProperty() dueDate?: string;
  @ApiProperty() note?: string;
  @ApiProperty() clientUpdatedAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty() deletedAt?: string;
  @ApiProperty() version: number;
}

export class CreateAssetRequest {
  @ApiProperty() @IsString() clientUid: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() platform?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsString() amount: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() shareCount?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() risk?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() liquidity?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty() @IsDateString() clientUpdatedAt: string;
}

export class UpdateAssetRequest {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() type?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() platform?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() amount?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() shareCount?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() risk?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() liquidity?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty() @IsDateString() clientUpdatedAt: string;
}

export class CreateLiabilityRequest {
  @ApiProperty() @IsString() clientUid: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsString() amount: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty() @IsDateString() clientUpdatedAt: string;
}

export class UpdateLiabilityRequest {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() type?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() amount?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
  @ApiProperty() @IsDateString() clientUpdatedAt: string;
}
