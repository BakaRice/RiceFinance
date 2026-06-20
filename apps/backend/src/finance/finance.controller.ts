import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FinanceService } from './finance.service';
import {
  AssetResponse, LiabilityResponse,
  CreateAssetRequest, UpdateAssetRequest,
  CreateLiabilityRequest, UpdateLiabilityRequest,
} from './finance.dto';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get('assets')
  listAssets(@CurrentUser() user: any): Promise<AssetResponse[]> {
    return this.financeService.listAssets(user.userId);
  }

  @Post('assets')
  createAsset(@CurrentUser() user: any, @Body() req: CreateAssetRequest): Promise<AssetResponse> {
    return this.financeService.createAsset(user.userId, req);
  }

  @Patch('assets/:id')
  updateAsset(@CurrentUser() user: any, @Param('id') id: string, @Body() req: UpdateAssetRequest): Promise<AssetResponse> {
    return this.financeService.updateAsset(user.userId, id, req);
  }

  @Delete('assets/:id')
  async deleteAsset(@CurrentUser() user: any, @Param('id') id: string): Promise<{ ok: boolean }> {
    await this.financeService.deleteAsset(user.userId, id);
    return { ok: true };
  }

  @Get('liabilities')
  listLiabilities(@CurrentUser() user: any): Promise<LiabilityResponse[]> {
    return this.financeService.listLiabilities(user.userId);
  }

  @Post('liabilities')
  createLiability(@CurrentUser() user: any, @Body() req: CreateLiabilityRequest): Promise<LiabilityResponse> {
    return this.financeService.createLiability(user.userId, req);
  }

  @Patch('liabilities/:id')
  updateLiability(@CurrentUser() user: any, @Param('id') id: string, @Body() req: UpdateLiabilityRequest): Promise<LiabilityResponse> {
    return this.financeService.updateLiability(user.userId, id, req);
  }

  @Delete('liabilities/:id')
  async deleteLiability(@CurrentUser() user: any, @Param('id') id: string): Promise<{ ok: boolean }> {
    await this.financeService.deleteLiability(user.userId, id);
    return { ok: true };
  }
}
