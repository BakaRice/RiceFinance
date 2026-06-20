import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const oldDb = new Pool({
  connectionString: process.env.OLD_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rice_finance',
});

interface OldUser { id: string; email: string; password_hash: string; display_name: string | null; base_currency: string; created_at: Date; updated_at: Date; }
interface OldAsset { id: string; user_id: string; client_uid: string; name: string; type: string; platform: string | null; currency: string; amount: string; share_count: string | null; risk: string | null; liquidity: string | null; note: string | null; client_updated_at: Date; created_at: Date; updated_at: Date; deleted_at: Date | null; version: number; }
interface OldLiability { id: string; user_id: string; client_uid: string; name: string; type: string; currency: string; amount: string; due_date: Date | null; note: string | null; client_updated_at: Date; created_at: Date; updated_at: Date; deleted_at: Date | null; version: number; }
interface OldSnapshot { id: string; user_id: string; client_uid: string; snapshot_date: string; total_assets: string; total_liabilities: string; net_worth: string; currency: string; note: string | null; client_updated_at: Date; created_at: Date; updated_at: Date; deleted_at: Date | null; version: number; }
interface OldSnapshotItem { id: string; user_id: string; snapshot_client_uid: string; client_uid: string; source_name: string; amount: string; category: string | null; risk: string | null; liquidity: string | null; is_liability: boolean; created_at: Date; updated_at: Date; }
interface OldReport { id: string; user_id: string; client_uid: string; title: string; report_type: string; markdown: string; summary_json: any; generated_at: Date; client_updated_at: Date; created_at: Date; updated_at: Date; deleted_at: Date | null; version: number; }
interface OldExchangeRate { id: string; base_currency: string; target_currency: string; rate: string; rate_date: string; source: string; created_at: Date; updated_at: Date; }

async function migrate() {
  console.log('=== RiceFinance Data Migration: Old DB → V2 DB ===\n');

  // --- Users ---
  const { rows: oldUsers } = await oldDb.query<OldUser>('SELECT * FROM users ORDER BY created_at');
  console.log(`Found ${oldUsers.length} users in old DB`);
  for (const u of oldUsers) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id, email: u.email, passwordHash: u.password_hash,
        displayName: u.display_name, baseCurrency: u.base_currency,
        createdAt: u.created_at, updatedAt: u.updated_at,
      },
      update: { email: u.email, passwordHash: u.password_hash },
    });
  }
  console.log(`Users migrated: ${oldUsers.length}`);

  // --- Assets ---
  const { rows: oldAssets } = await oldDb.query<OldAsset>('SELECT * FROM asset_accounts ORDER BY created_at');
  for (const a of oldAssets) {
    await prisma.assetAccount.upsert({
      where: { id: a.id },
      create: {
        id: a.id, userId: a.user_id, clientUid: a.client_uid,
        name: a.name, type: a.type, platform: a.platform,
        currency: a.currency, amount: new Decimal(a.amount),
        shareCount: a.share_count ? new Decimal(a.share_count) : null,
        risk: a.risk || 'medium', liquidity: a.liquidity || 'medium',
        note: a.note, clientUpdatedAt: a.client_updated_at,
        createdAt: a.created_at, updatedAt: a.updated_at,
        deletedAt: a.deleted_at, version: a.version,
      },
      update: { name: a.name },
    });
  }
  console.log(`Assets migrated: ${oldAssets.length}`);

  // --- Liabilities ---
  const { rows: oldLiabs } = await oldDb.query<OldLiability>('SELECT * FROM liability_accounts ORDER BY created_at');
  for (const l of oldLiabs) {
    await prisma.liabilityAccount.upsert({
      where: { id: l.id },
      create: {
        id: l.id, userId: l.user_id, clientUid: l.client_uid,
        name: l.name, type: l.type, currency: l.currency,
        amount: new Decimal(l.amount), dueDate: l.due_date,
        note: l.note, clientUpdatedAt: l.client_updated_at,
        createdAt: l.created_at, updatedAt: l.updated_at,
        deletedAt: l.deleted_at, version: l.version,
      },
      update: { name: l.name },
    });
  }
  console.log(`Liabilities migrated: ${oldLiabs.length}`);

  // --- Snapshots ---
  const { rows: oldSnapshots } = await oldDb.query<OldSnapshot>('SELECT * FROM net_worth_snapshots ORDER BY created_at');
  for (const s of oldSnapshots) {
    await prisma.netWorthSnapshot.upsert({
      where: { id: s.id },
      create: {
        id: s.id, userId: s.user_id, clientUid: s.client_uid,
        snapshotDate: new Date(s.snapshot_date),
        totalAssets: new Decimal(s.total_assets),
        totalLiabilities: new Decimal(s.total_liabilities),
        netWorth: new Decimal(s.net_worth),
        currency: s.currency, note: s.note,
        clientUpdatedAt: s.client_updated_at,
        createdAt: s.created_at, updatedAt: s.updated_at,
        deletedAt: s.deleted_at, version: s.version,
      },
      update: { note: s.note },
    });
  }
  console.log(`Snapshots migrated: ${oldSnapshots.length}`);

  // --- Snapshot Items ---
  const { rows: oldItems } = await oldDb.query<OldSnapshotItem>('SELECT * FROM snapshot_items ORDER BY created_at');
  for (const i of oldItems) {
    await prisma.snapshotItem.upsert({
      where: { id: i.id },
      create: {
        id: i.id, userId: i.user_id, snapshotClientUid: i.snapshot_client_uid,
        clientUid: i.client_uid, sourceName: i.source_name,
        amount: new Decimal(i.amount), category: i.category,
        risk: i.risk, liquidity: i.liquidity, isLiability: i.is_liability,
        createdAt: i.created_at, updatedAt: i.updated_at,
      },
      update: { sourceName: i.source_name },
    });
  }
  console.log(`Snapshot items migrated: ${oldItems.length}`);

  // --- Reports ---
  const { rows: oldReports } = await oldDb.query<OldReport>('SELECT * FROM reports ORDER BY created_at');
  for (const r of oldReports) {
    await prisma.report.upsert({
      where: { id: r.id },
      create: {
        id: r.id, userId: r.user_id, clientUid: r.client_uid,
        title: r.title, reportType: r.report_type,
        markdown: r.markdown, summaryJson: r.summary_json || Prisma.JsonNull,
        generatedAt: r.generated_at, clientUpdatedAt: r.client_updated_at,
        createdAt: r.created_at, updatedAt: r.updated_at,
        deletedAt: r.deleted_at, version: r.version,
      },
      update: { title: r.title },
    });
  }
  console.log(`Reports migrated: ${oldReports.length}`);

  // --- Exchange Rates ---
  const { rows: oldRates } = await oldDb.query<OldExchangeRate>('SELECT * FROM exchange_rates ORDER BY created_at');
  for (const r of oldRates) {
    await prisma.exchangeRate.upsert({
      where: { id: r.id },
      create: {
        id: r.id, baseCurrency: r.base_currency, targetCurrency: r.target_currency,
        rate: new Decimal(r.rate), rateDate: new Date(r.rate_date),
        source: r.source, createdAt: r.created_at, updatedAt: r.updated_at,
      },
      update: { rate: new Decimal(r.rate) },
    });
  }
  console.log(`Exchange rates migrated: ${oldRates.length}`);

  // --- Validation ---
  console.log('\n=== Validation ===');
  const v2Users = await prisma.user.count();
  const v2Assets = await prisma.assetAccount.count();
  const v2Liabs = await prisma.liabilityAccount.count();
  const v2Snapshots = await prisma.netWorthSnapshot.count();
  const v2Items = await prisma.snapshotItem.count();
  const v2Reports = await prisma.report.count();
  const v2Rates = await prisma.exchangeRate.count();

  console.log(`Users:    ${oldUsers.length} → ${v2Users} ${oldUsers.length === v2Users ? '✓' : '✗ MISMATCH'}`);
  console.log(`Assets:   ${oldAssets.length} → ${v2Assets} ${oldAssets.length === v2Assets ? '✓' : '✗ MISMATCH'}`);
  console.log(`Liabilities: ${oldLiabs.length} → ${v2Liabs} ${oldLiabs.length === v2Liabs ? '✓' : '✗ MISMATCH'}`);
  console.log(`Snapshots: ${oldSnapshots.length} → ${v2Snapshots} ${oldSnapshots.length === v2Snapshots ? '✓' : '✗ MISMATCH'}`);
  console.log(`Items:    ${oldItems.length} → ${v2Items} ${oldItems.length === v2Items ? '✓' : '✗ MISMATCH'}`);
  console.log(`Reports:  ${oldReports.length} → ${v2Reports} ${oldReports.length === v2Reports ? '✓' : '✗ MISMATCH'}`);
  console.log(`Rates:    ${oldRates.length} → ${v2Rates} ${oldRates.length === v2Rates ? '✓' : '✗ MISMATCH'}`);

  // Per-user financial checks
  console.log('\n--- Per-User Financial Checks ---');
  const users = await prisma.user.findMany();
  for (const user of users) {
    const assets = await prisma.assetAccount.findMany({ where: { userId: user.id, deletedAt: null } });
    const liabs = await prisma.liabilityAccount.findMany({ where: { userId: user.id, deletedAt: null } });
    const totalAssets = assets.reduce((s, a) => s.plus(a.amount), new Decimal(0));
    const totalLiabs = liabs.reduce((s, l) => s.plus(l.amount), new Decimal(0));
    const netWorth = totalAssets.minus(totalLiabs);
    console.log(`User ${user.email}: Assets=${totalAssets} Liabilities=${totalLiabs} NetWorth=${netWorth}`);
  }

  console.log('\n=== Migration Complete ===');
  await oldDb.end();
  await prisma.$disconnect();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
