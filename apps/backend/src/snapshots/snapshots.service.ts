import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { CreateSnapshotRequest, SnapshotResponse } from './snapshots.dto';

@Injectable()
export class SnapshotsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string): Promise<SnapshotResponse[]> {
    const snapshots = await this.prisma.netWorthSnapshot.findMany({
      where: { userId, deletedAt: null },
      orderBy: { snapshotDate: 'desc' },
    });
    return snapshots.map(s => ({
      id: s.id,
      clientUid: s.clientUid,
      snapshotDate: s.snapshotDate.toISOString().split('T')[0],
      totalAssets: s.totalAssets.toString(),
      totalLiabilities: s.totalLiabilities.toString(),
      netWorth: s.netWorth.toString(),
      currency: s.currency,
      note: s.note || undefined,
      clientUpdatedAt: s.clientUpdatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      version: s.version,
    }));
  }

  async getById(userId: string, id: string): Promise<SnapshotResponse> {
    const snapshot = await this.prisma.netWorthSnapshot.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!snapshot) throw new AppError(ErrorCode.NOT_FOUND, 'Snapshot not found');

    const items = await this.prisma.snapshotItem.findMany({
      where: { userId, snapshotClientUid: snapshot.clientUid },
    });

    return {
      id: snapshot.id,
      clientUid: snapshot.clientUid,
      snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
      totalAssets: snapshot.totalAssets.toString(),
      totalLiabilities: snapshot.totalLiabilities.toString(),
      netWorth: snapshot.netWorth.toString(),
      currency: snapshot.currency,
      note: snapshot.note || undefined,
      clientUpdatedAt: snapshot.clientUpdatedAt.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
      version: snapshot.version,
      items: items.map(i => ({
        id: i.id, clientUid: i.clientUid, sourceName: i.sourceName,
        amount: i.amount.toString(), category: i.category || undefined,
        risk: i.risk || undefined, liquidity: i.liquidity || undefined,
        isLiability: i.isLiability,
      })),
    };
  }

  async create(userId: string, req: CreateSnapshotRequest): Promise<SnapshotResponse> {
    const assets = await this.prisma.assetAccount.findMany({
      where: { userId, deletedAt: null },
    });
    const liabilities = await this.prisma.liabilityAccount.findMany({
      where: { userId, deletedAt: null },
    });

    const currency = req.currency || 'CNY';
    const totalAssets = assets.reduce((sum, a) => sum.plus(a.amount), new Decimal(0));
    const totalLiabilities = liabilities.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    const netWorth = totalAssets.minus(totalLiabilities);

    const snapshot = await this.prisma.netWorthSnapshot.create({
      data: {
        userId, clientUid: req.clientUid,
        snapshotDate: new Date(req.snapshotDate),
        totalAssets, totalLiabilities, netWorth, currency,
        note: req.note || null,
        clientUpdatedAt: new Date(),
      },
    });

    const items = [
      ...assets.map(a => ({
        userId, snapshotClientUid: snapshot.clientUid,
        clientUid: uuid(), sourceName: a.name, amount: a.amount,
        category: a.type, risk: a.risk, liquidity: a.liquidity,
        isLiability: false,
      })),
      ...liabilities.map(l => ({
        userId, snapshotClientUid: snapshot.clientUid,
        clientUid: uuid(), sourceName: l.name, amount: l.amount,
        category: l.type, risk: null, liquidity: null,
        isLiability: true,
      })),
    ];

    if (items.length > 0) {
      await this.prisma.snapshotItem.createMany({ data: items });
    }

    return this.getById(userId, snapshot.id);
  }
}
