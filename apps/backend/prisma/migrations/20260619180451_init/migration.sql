-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "base_currency" TEXT NOT NULL DEFAULT 'CNY',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platform" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "amount" DECIMAL(20,4) NOT NULL,
    "share_count" DECIMAL(20,4),
    "risk" TEXT DEFAULT 'medium',
    "liquidity" TEXT DEFAULT 'medium',
    "note" TEXT,
    "client_updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asset_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liability_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "amount" DECIMAL(20,4) NOT NULL,
    "due_date" TIMESTAMPTZ,
    "note" TEXT,
    "client_updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "liability_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "net_worth_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_uid" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "total_assets" DECIMAL(20,4) NOT NULL,
    "total_liabilities" DECIMAL(20,4) NOT NULL,
    "net_worth" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "note" TEXT,
    "client_updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshot_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "snapshot_client_uid" TEXT NOT NULL,
    "client_uid" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "category" TEXT,
    "risk" TEXT,
    "liquidity" TEXT,
    "is_liability" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_uid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "summary_json" JSONB,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "client_updated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "base_currency" TEXT NOT NULL,
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(20,6) NOT NULL,
    "rate_date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "asset_accounts_user_id_updated_at_deleted_at_idx" ON "asset_accounts"("user_id", "updated_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "asset_accounts_user_id_client_uid_key" ON "asset_accounts"("user_id", "client_uid");

-- CreateIndex
CREATE INDEX "liability_accounts_user_id_updated_at_deleted_at_idx" ON "liability_accounts"("user_id", "updated_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "liability_accounts_user_id_client_uid_key" ON "liability_accounts"("user_id", "client_uid");

-- CreateIndex
CREATE INDEX "net_worth_snapshots_user_id_updated_at_deleted_at_idx" ON "net_worth_snapshots"("user_id", "updated_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "net_worth_snapshots_user_id_client_uid_key" ON "net_worth_snapshots"("user_id", "client_uid");

-- CreateIndex
CREATE INDEX "snapshot_items_user_id_snapshot_client_uid_idx" ON "snapshot_items"("user_id", "snapshot_client_uid");

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_items_user_id_client_uid_key" ON "snapshot_items"("user_id", "client_uid");

-- CreateIndex
CREATE INDEX "reports_user_id_updated_at_deleted_at_idx" ON "reports"("user_id", "updated_at", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_user_id_client_uid_key" ON "reports"("user_id", "client_uid");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_target_currency_rate_date_key" ON "exchange_rates"("base_currency", "target_currency", "rate_date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_accounts" ADD CONSTRAINT "asset_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_accounts" ADD CONSTRAINT "liability_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_items" ADD CONSTRAINT "snapshot_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
