import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import {
  AssetResponse, LiabilityResponse,
  CreateAssetRequest, UpdateAssetRequest,
  CreateLiabilityRequest, UpdateLiabilityRequest,
} from './finance.dto';

function decToStr(d: Decimal | null | undefined): string | undefined {
  return d ? d.toString() : undefined;
}

function toAssetResponse(a: any): AssetResponse {
  return {
    id: a.id, clientUid: a.clientUid, name: a.name, type: a.type,
    platform: a.platform || undefined, currency: a.currency,
    amount: a.amount.toString(), shareCount: decToStr(a.shareCount),
    risk: a.risk || 'medium', liquidity: a.liquidity || 'medium',
    note: a.note || undefined,
    clientUpdatedAt: a.clientUpdatedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    deletedAt: a.deletedAt?.toISOString() || undefined,
    version: a.version,
  };
}

function toLiabilityResponse(l: any): LiabilityResponse {
  return {
    id: l.id, clientUid: l.clientUid, name: l.name, type: l.type,
    currency: l.currency, amount: l.amount.toString(),
    dueDate: l.dueDate?.toISOString() || undefined,
    note: l.note || undefined,
    clientUpdatedAt: l.clientUpdatedAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    deletedAt: l.deletedAt?.toISOString() || undefined,
    version: l.version,
  };
}

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  // --- Assets ---
  async listAssets(userId: string): Promise<AssetResponse[]> {
    const assets = await this.prisma.assetAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return assets.map(toAssetResponse);
  }

  async createAsset(userId: string, req: CreateAssetRequest): Promise<AssetResponse> {
    const existing = await this.prisma.assetAccount.findUnique({
      where: { userId_clientUid: { userId, clientUid: req.clientUid } },
    });
    if (existing) throw new AppError(ErrorCode.CONFLICT, 'Asset with this clientUid already exists');

    const asset = await this.prisma.assetAccount.create({
      data: {
        userId, clientUid: req.clientUid, name: req.name, type: req.type,
        platform: req.platform || null, currency: req.currency || 'CNY',
        amount: new Decimal(req.amount),
        shareCount: req.shareCount ? new Decimal(req.shareCount) : null,
        risk: req.risk || 'medium', liquidity: req.liquidity || 'medium',
        note: req.note || null, clientUpdatedAt: new Date(req.clientUpdatedAt),
      },
    });
    return toAssetResponse(asset);
  }

  async updateAsset(userId: string, id: string, req: UpdateAssetRequest): Promise<AssetResponse> {
    const existing = await this.prisma.assetAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Asset not found');

    const data: any = { clientUpdatedAt: new Date(req.clientUpdatedAt) };
    if (req.name !== undefined) data.name = req.name;
    if (req.type !== undefined) data.type = req.type;
    if (req.platform !== undefined) data.platform = req.platform;
    if (req.currency !== undefined) data.currency = req.currency;
    if (req.amount !== undefined) data.amount = new Decimal(req.amount);
    if (req.shareCount !== undefined) data.shareCount = req.shareCount ? new Decimal(req.shareCount) : null;
    if (req.risk !== undefined) data.risk = req.risk;
    if (req.liquidity !== undefined) data.liquidity = req.liquidity;
    if (req.note !== undefined) data.note = req.note;

    const asset = await this.prisma.assetAccount.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
    return toAssetResponse(asset);
  }

  async deleteAsset(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.assetAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Asset not found');
    await this.prisma.assetAccount.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  // --- Liabilities ---
  async listLiabilities(userId: string): Promise<LiabilityResponse[]> {
    const liabs = await this.prisma.liabilityAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return liabs.map(toLiabilityResponse);
  }

  async createLiability(userId: string, req: CreateLiabilityRequest): Promise<LiabilityResponse> {
    const existing = await this.prisma.liabilityAccount.findUnique({
      where: { userId_clientUid: { userId, clientUid: req.clientUid } },
    });
    if (existing) throw new AppError(ErrorCode.CONFLICT, 'Liability with this clientUid already exists');

    const liab = await this.prisma.liabilityAccount.create({
      data: {
        userId, clientUid: req.clientUid, name: req.name, type: req.type,
        currency: req.currency || 'CNY', amount: new Decimal(req.amount),
        dueDate: req.dueDate ? new Date(req.dueDate) : null,
        note: req.note || null, clientUpdatedAt: new Date(req.clientUpdatedAt),
      },
    });
    return toLiabilityResponse(liab);
  }

  async updateLiability(userId: string, id: string, req: UpdateLiabilityRequest): Promise<LiabilityResponse> {
    const existing = await this.prisma.liabilityAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Liability not found');

    const data: any = { clientUpdatedAt: new Date(req.clientUpdatedAt) };
    if (req.name !== undefined) data.name = req.name;
    if (req.type !== undefined) data.type = req.type;
    if (req.currency !== undefined) data.currency = req.currency;
    if (req.amount !== undefined) data.amount = new Decimal(req.amount);
    if (req.dueDate !== undefined) data.dueDate = req.dueDate ? new Date(req.dueDate) : null;
    if (req.note !== undefined) data.note = req.note;

    const liab = await this.prisma.liabilityAccount.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
    return toLiabilityResponse(liab);
  }

  async deleteLiability(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.liabilityAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Liability not found');
    await this.prisma.liabilityAccount.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}
