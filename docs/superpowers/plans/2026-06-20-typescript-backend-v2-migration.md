# RiceFinance TypeScript 后端 V2 迁移 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 RiceFinance 后端从 Java/Spring Boot 迁移到 TypeScript/NestJS/Prisma，一次性离线迁移现有数据，并改造 Web 端适配新 API。

**Architecture:** NestJS 模块化后端（auth/users/finance/snapshots/reports/exchange/stats/ai），Prisma ORM 管理 PostgreSQL，JWT access token + refresh token rotation，资源导向 REST API。Web 端通过生成的 OpenAPI typed client 对接新 API。

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, JWT (Argon2/bcrypt), Jest, Docker Compose, openapi-typescript

## 全局约束

- 金额字段必须使用 PostgreSQL Decimal，API 输出字符串，避免浮点精度
- 所有 API 输入必须有运行时 schema 校验（NestJS class-validator + 必要时 Zod）
- 旧数据库必须用 pg_dump 备份后才能操作
- 使用新 V2 数据库，不在旧库上原地改造
- ID 保留 UUID 主键 + clientUid
- 软删除保留 deletedAt，版本号保留 version
- 消费流水和 Agent 月度复盘本期不做，只预留架构空间
- 不要为了减少 Web 改动而保留旧 API 契约
- 密码哈希不保留（要求用户重新登录），不迁移 refresh token

---

## 阶段 0：备份与旧系统盘点

### Task 0.1：确认当前数据库连接信息

**Files:**
- Read: `apps/backend/src/main/resources/application.yml`
- Read: `apps/backend/docker-compose.yml`

**描述：** 从现有配置中提取数据库连接信息（host、port、database name、用户名），确认旧数据库可访问。

- [ ] **Step 1：读取并记录旧数据库连接信息**

```bash
cat apps/backend/src/main/resources/application.yml | grep -A5 datasource
cat apps/backend/docker-compose.yml | grep -A5 DATABASE
```

- [ ] **Step 2：测试数据库连接**

```bash
# 假设 docker-compose 中 PostgreSQL 正在运行
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\dt"
```

记录输出中的表名列表，用于后续迁移校验。

- [ ] **Step 3：确认现有数据量**

```bash
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "
SELECT 'users' as tbl, count(*) FROM users
UNION ALL SELECT 'asset_accounts', count(*) FROM asset_accounts
UNION ALL SELECT 'liability_accounts', count(*) FROM liability_accounts
UNION ALL SELECT 'net_worth_snapshots', count(*) FROM net_worth_snapshots
UNION ALL SELECT 'snapshot_items', count(*) FROM snapshot_items
UNION ALL SELECT 'reports', count(*) FROM reports
UNION ALL SELECT 'exchange_rates', count(*) FROM exchange_rates
UNION ALL SELECT 'refresh_tokens', count(*) FROM refresh_tokens;
"
```

记录每张表的行数，用于迁移后校验。

- [ ] **Step 4：记录关键财务合计**

```bash
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "
SELECT
  u.email,
  COALESCE(a.total_assets, 0) as total_assets,
  COALESCE(l.total_liabilities, 0) as total_liabilities,
  COALESCE(a.total_assets, 0) - COALESCE(l.total_liabilities, 0) as net_worth
FROM users u
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) as total_assets FROM asset_accounts WHERE user_id = u.id AND deleted_at IS NULL
) a ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) as total_liabilities FROM liability_accounts WHERE user_id = u.id AND deleted_at IS NULL
) l ON true;
"
```

保存此输出，迁移后需要逐行比对。

### Task 0.2：备份旧数据库

**Files:**
- Create: `backups/ricefinance-before-ts-v2.sql`

**描述：** 使用 pg_dump 对旧数据库做完整备份。

- [ ] **Step 1：创建备份目录并执行 pg_dump**

```bash
mkdir -p backups
# 从 docker-compose 或 application.yml 获取连接信息
pg_dump "postgresql://postgres:postgres@localhost:5432/rice_finance" > backups/ricefinance-before-ts-v2.sql
# 如果通过 docker，使用：
# docker exec <postgres-container> pg_dump -U postgres rice_finance > backups/ricefinance-before-ts-v2.sql
```

- [ ] **Step 2：确认备份文件可读且非空**

```bash
wc -l backups/ricefinance-before-ts-v2.sql
head -50 backups/ricefinance-before-ts-v2.sql
```

确认备份文件包含 CREATE TABLE 语句和数据 INSERT 语句。

- [ ] **Step 3：记录旧 schema 结构**

```bash
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ users"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ asset_accounts"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ liability_accounts"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ net_worth_snapshots"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ snapshot_items"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ reports"
docker exec -it $(docker ps --filter "ancestor=postgres" -q) psql -U postgres -d rice_finance -c "\d+ exchange_rates"
```

将输出保存到笔记中，作为 Prisma schema 设计的参考。

- [ ] **Step 5：Commit 备份记录**

```bash
echo "backups/" >> .gitignore  # 确保备份文件不被提交
git add .gitignore
git commit -m "chore: add backups/ to .gitignore"
```

---

## 阶段 1：设计与契约

### Task 1.1：确认 Prisma schema 设计

**Files:**
- Create: `apps/backend/prisma/schema.prisma`

**描述：** 基于旧数据库 schema 和 V2 设计方案，创建 Prisma schema。保留核心语义但做命名和字段清理。

- [ ] **Step 1：编写 Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  displayName  String?  @map("display_name")
  baseCurrency String   @default("CNY") @map("base_currency")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  refreshTokens RefreshToken[]
  assetAccounts AssetAccount[]
  liabilityAccounts LiabilityAccount[]
  netWorthSnapshots NetWorthSnapshot[]
  snapshotItems SnapshotItem[]
  reports       Report[]

  @@map("users")
}

model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz()
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz()
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz()

  user User @relation(fields: [userId], references: [id])

  @@map("refresh_tokens")
}

model AssetAccount {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @map("user_id") @db.Uuid
  clientUid      String    @map("client_uid")
  name           String
  type           String
  platform       String?
  currency       String    @default("CNY")
  amount         Decimal   @db.Decimal(20, 4)
  shareCount     Decimal?  @map("share_count") @db.Decimal(20, 4)
  risk           String?   @default("medium")
  liquidity      String?   @default("medium")
  note           String?
  clientUpdatedAt DateTime @map("client_updated_at") @db.Timestamptz()
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz()
  version        Int       @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, clientUid])
  @@index([userId, updatedAt, deletedAt])
  @@map("asset_accounts")
}

model LiabilityAccount {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @map("user_id") @db.Uuid
  clientUid      String    @map("client_uid")
  name           String
  type           String
  currency       String    @default("CNY")
  amount         Decimal   @db.Decimal(20, 4)
  dueDate        DateTime? @map("due_date") @db.Timestamptz()
  note           String?
  clientUpdatedAt DateTime @map("client_updated_at") @db.Timestamptz()
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz()
  version        Int       @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, clientUid])
  @@index([userId, updatedAt, deletedAt])
  @@map("liability_accounts")
}

model NetWorthSnapshot {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  clientUid       String    @map("client_uid")
  snapshotDate    DateTime  @map("snapshot_date") @db.Date
  totalAssets     Decimal   @map("total_assets") @db.Decimal(20, 4)
  totalLiabilities Decimal  @map("total_liabilities") @db.Decimal(20, 4)
  netWorth        Decimal   @map("net_worth") @db.Decimal(20, 4)
  currency        String    @default("CNY")
  note            String?
  clientUpdatedAt DateTime  @map("client_updated_at") @db.Timestamptz()
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz()
  version         Int       @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, clientUid])
  @@index([userId, updatedAt, deletedAt])
  @@map("net_worth_snapshots")
}

model SnapshotItem {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  snapshotClientUid String  @map("snapshot_client_uid")
  clientUid        String   @map("client_uid")
  sourceName       String   @map("source_name")
  amount           Decimal  @db.Decimal(20, 4)
  category         String?
  risk             String?
  liquidity        String?
  isLiability      Boolean  @default(false) @map("is_liability")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, clientUid])
  @@index([userId, snapshotClientUid])
  @@map("snapshot_items")
}

model Report {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  clientUid       String    @map("client_uid")
  title           String
  reportType      String    @map("report_type")
  markdown        String
  summaryJson     Json?     @map("summary_json") @db.JsonB
  generatedAt     DateTime  @map("generated_at") @db.Timestamptz()
  clientUpdatedAt DateTime  @map("client_updated_at") @db.Timestamptz()
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz()
  version         Int       @default(0)

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, clientUid])
  @@index([userId, updatedAt, deletedAt])
  @@map("reports")
}

model ExchangeRate {
  id            String   @id @default(uuid()) @db.Uuid
  baseCurrency  String   @map("base_currency")
  targetCurrency String  @map("target_currency")
  rate          Decimal  @db.Decimal(20, 6)
  rateDate      DateTime @map("rate_date") @db.Date
  source        String   @default("manual")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  @@unique([baseCurrency, targetCurrency, rateDate])
  @@map("exchange_rates")
}
```

- [ ] **Step 2：与旧 schema 做对照检查**

确认：
- 所有旧表都被映射（users, refresh_tokens, asset_accounts, liability_accounts, net_worth_snapshots, snapshot_items, reports, exchange_rates）
- 字段类型兼容 PostgreSQL（Decimal、UUID、JSONB、timestamptz 等）
- unique 约束和索引与旧库一致

### Task 1.2：设计 API 契约和 DTO

**Files:**
- Design: API 路径和 DTO 形态（在 NestJS 代码中以 class-validator 装饰器实现）

**描述：** 按迁移方案第 9 节确认 V2 API 路径和 DTO 形态。

- [ ] **Step 1：确认 API 路径表**

```text
# Auth (公开)
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout          # 需认证

# User (需认证)
GET  /users/me

# Finance - Assets (需认证)
GET    /finance/assets
POST   /finance/assets
PATCH  /finance/assets/:id
DELETE /finance/assets/:id

# Finance - Liabilities (需认证)
GET    /finance/liabilities
POST   /finance/liabilities
PATCH  /finance/liabilities/:id
DELETE /finance/liabilities/:id

# Snapshots (需认证)
GET    /snapshots
POST   /snapshots
GET    /snapshots/:id

# Stats (需认证)
GET  /stats/overview

# Reports (需认证)
GET  /reports
GET  /reports/latest-ai-review
POST /ai/reviews

# Exchange Rates (需认证)
GET  /exchange/rates
POST /exchange/rates
```

- [ ] **Step 2：确认统一错误格式**

```typescript
// 所有 API 错误统一格式
interface ApiError {
  error: {
    code: string;        // VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | AI_SERVICE_ERROR | INTERNAL_ERROR
    message: string;
    details?: any[];
  }
}
```

- [ ] **Step 3：确认认证 DTO 形态**

```typescript
// POST /auth/register
class RegisterRequest {
  @IsEmail() email: string;
  @MinLength(8) password: string;
  @IsOptional() displayName?: string;
  @IsOptional() baseCurrency?: string; // 默认 CNY
}

// POST /auth/login
class LoginRequest {
  @IsEmail() email: string;
  password: string;
}

// POST /auth/refresh
class RefreshRequest {
  refreshToken: string;
}

// Auth Response (所有 auth 端点统一)
class AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}
```

---

## 阶段 2：替换后端目录并建立 TS 骨架

### Task 2.1：删除旧 Java 后端代码

**Files:**
- Delete: `apps/backend/src/main/java/` (全部)
- Delete: `apps/backend/src/main/resources/` (全部)
- Delete: `apps/backend/src/test/` (全部)
- Delete: `apps/backend/build.gradle`
- Delete: `apps/backend/settings.gradle`
- Delete: `apps/backend/gradlew`
- Delete: `apps/backend/gradlew.bat`
- Delete: `apps/backend/gradle/`
- Delete: `apps/backend/Dockerfile`
- Delete: `apps/backend/docker-compose.yml`
- Delete: `apps/backend/CLAUDE.md`
- Delete: `apps/backend/README.md`
- Delete: `apps/backend/.claude/settings.local.json`

**描述：** 删除所有 Java/Spring Boot 相关文件，保留 `.gitignore`（可后续修改）。

- [ ] **Step 1：确认当前在正确的分支上，旧代码已提交**

```bash
cd /Users/tanwentao/Documents/project/RiceFinance
git status
git log --oneline -5
```

- [ ] **Step 2：删除所有 Java 后端文件**

```bash
cd apps/backend

# 删除 Java 源码
rm -rf src/main/java/
rm -rf src/main/resources/
rm -rf src/test/

# 删除 Gradle 构建系统
rm -f build.gradle
rm -f settings.gradle
rm -f gradlew
rm -f gradlew.bat
rm -rf gradle/

# 删除旧 Docker 和配置
rm -f Dockerfile
rm -f docker-compose.yml

# 删除旧文档
rm -f CLAUDE.md
rm -f README.md

# 删除 Claude 设置
rm -rf .claude/
```

- [ ] **Step 3：清理空目录**

```bash
# src/main 和 src 现在应该是空的
rmdir src/main/java 2>/dev/null || true
rmdir src/main 2>/dev/null || true
rmdir src 2>/dev/null || true
```

- [ ] **Step 4：保留 .gitignore，如果需要可以更新**

```bash
ls -la apps/backend/
# 应该只剩 .gitignore 或空目录
```

- [ ] **Step 5：Commit 删除**

```bash
cd /Users/tanwentao/Documents/project/RiceFinance
git add -A
git commit -m "chore: remove Java/Spring Boot backend code

Preparing for TypeScript/NestJS backend V2 migration. Old code
remains accessible via git history.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2.2：初始化 NestJS 项目

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/tsconfig.build.json`
- Create: `apps/backend/nest-cli.json`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/.gitignore`
- Create: `apps/backend/Dockerfile`
- Create: `apps/backend/docker-compose.yml`
- Create: `apps/backend/jest.config.js`

**描述：** 初始化 NestJS + TypeScript 项目骨架，安装依赖。

- [ ] **Step 1：创建 package.json**

```bash
cd apps/backend
npm init -y
```

然后修改 `package.json`：

```json
{
  "name": "rice-finance-backend-v2",
  "version": "0.1.0",
  "description": "RiceFinance TypeScript Backend V2",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:prod": "prisma migrate deploy",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/swagger": "^7.4.0",
    "@prisma/client": "^5.19.0",
    "argon2": "^0.41.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.2.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^22.5.0",
    "@types/passport-jwt": "^4.0.1",
    "@types/uuid": "^10.0.0",
    "jest": "^29.7.0",
    "prisma": "^5.19.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2：安装依赖**

```bash
npm install
```

- [ ] **Step 3：创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 4：创建 tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 5：创建 nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 6：创建 .env.example**

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rice_finance_v2

# JWT
JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# AI Provider
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# CORS
CORS_ORIGINS=http://localhost:5173

# Defaults
DEFAULT_BASE_CURRENCY=CNY
```

- [ ] **Step 7：创建 .gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 8：创建 jest.config.js**

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

- [ ] **Step 9：创建 Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

- [ ] **Step 10：创建 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: rice_finance_v2
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/rice_finance_v2
      JWT_ACCESS_SECRET: dev-access-secret-change-me
      JWT_REFRESH_SECRET: dev-refresh-secret-change-me
      JWT_ACCESS_EXPIRATION: 15m
      JWT_REFRESH_EXPIRATION: 7d
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      DEEPSEEK_BASE_URL: https://api.deepseek.com
      DEEPSEEK_MODEL: deepseek-chat
      CORS_ORIGINS: http://localhost:5173
      DEFAULT_BASE_CURRENCY: CNY
    depends_on:
      - postgres

volumes:
  pgdata:
```

- [ ] **Step 11：Commit 项目骨架**

```bash
git add apps/backend/
git commit -m "feat: initialize NestJS + TypeScript backend V2 skeleton"
```

### Task 2.3：创建 NestJS 入口和核心模块

**Files:**
- Create: `apps/backend/src/main.ts`
- Create: `apps/backend/src/app.module.ts`
- Create: `apps/backend/src/config/env.config.ts`
- Create: `apps/backend/src/common/error.filter.ts`
- Create: `apps/backend/src/common/error.codes.ts`
- Create: `apps/backend/src/common/prisma.service.ts`

**Interfaces:**
- Produces: `PrismaService` — 全局单例 Prisma 客户端服务
- Produces: `EnvConfig` — 环境变量配置类型
- Produces: `ApiExceptionFilter` — 全局异常过滤器
- Produces: `ErrorCode` — 统一错误码枚举

**描述：** 创建 NestJS 入口文件、根模块、全局配置、错误处理和 Prisma 服务。

- [ ] **Step 1：创建 `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v2');

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend V2 running on http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 2：创建 `src/app.module.ts`**

```typescript
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
```

- [ ] **Step 3：创建 `src/config/env.config.ts`**

```typescript
export const envConfig = () => ({
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rice_finance_v2',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  },
  defaults: {
    baseCurrency: process.env.DEFAULT_BASE_CURRENCY || 'CNY',
  },
});

export type EnvConfig = ReturnType<typeof envConfig>;
```

- [ ] **Step 4：创建 `src/config/config.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { envConfig } from './env.config';

@Global()
@Module({
  providers: [
    {
      provide: 'ENV_CONFIG',
      useFactory: envConfig,
    },
  ],
  exports: ['ENV_CONFIG'],
})
export class ConfigModule {}
```

- [ ] **Step 5：创建 `src/common/error.codes.ts`**

```typescript
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: any[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

- [ ] **Step 6：创建 `src/common/error.filter.ts`**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorCode } from './error.codes';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      const status = this.mapCodeToStatus(exception.code);
      return response.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message = typeof res === 'string' ? res : (res as any).message || 'Validation failed';
      const code = status === 400 ? ErrorCode.VALIDATION_ERROR : ErrorCode.INTERNAL_ERROR;
      return response.status(status).json({
        error: { code, message, details: Array.isArray(message) ? message : undefined },
      });
    }

    this.logger.error('Unhandled exception', exception as Error);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  }

  private mapCodeToStatus(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.VALIDATION_ERROR: return 400;
      case ErrorCode.UNAUTHORIZED: return 401;
      case ErrorCode.FORBIDDEN: return 403;
      case ErrorCode.NOT_FOUND: return 404;
      case ErrorCode.CONFLICT: return 409;
      case ErrorCode.AI_SERVICE_ERROR: return 502;
      default: return 500;
    }
  }
}
```

- [ ] **Step 7：创建 `src/common/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 8：创建 `src/common/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 9：更新 `src/app.module.ts` — 注册全局异常过滤器**

更新 `src/main.ts`，添加 filter 注册：

```typescript
import { ApiExceptionFilter } from './common/error.filter';
// 在 bootstrap 中添加：
app.useGlobalFilters(new ApiExceptionFilter());
```

- [ ] **Step 10：验证骨架可编译运行**

```bash
cd apps/backend
npx prisma generate   # 生成 Prisma client（需要先有 schema.prisma）
npm run build          # 应该编译成功
```

- [ ] **Step 11：Commit**

```bash
git add apps/backend/src/
git commit -m "feat: add NestJS entry, config, error handling, and Prisma service"
```

---

## 阶段 3：Prisma Schema 与核心 API

### Task 3.1：创建 Prisma schema 并执行初始 migration

**Files:**
- Create: `apps/backend/prisma/schema.prisma`（内容见 Task 1.1）
- Create: `apps/backend/prisma/seed.ts`

**描述：** 将 Task 1.1 的 schema 写入文件，创建 V2 数据库，执行初始 migration。

- [ ] **Step 1：写入 Prisma schema**

将 Task 1.1 中的完整 schema 写入 `apps/backend/prisma/schema.prisma`。

- [ ] **Step 2：创建 V2 数据库**

```bash
# 如果通过 docker-compose：
cd apps/backend
docker compose up -d postgres

# 或者手动创建：
docker exec -it <postgres-container> psql -U postgres -c "CREATE DATABASE rice_finance_v2;"
```

- [ ] **Step 3：配置 .env**

```bash
cp .env.example .env
# 编辑 .env，确保 DATABASE_URL 指向 rice_finance_v2 库
```

- [ ] **Step 4：执行 Prisma migration**

```bash
cd apps/backend
npx prisma migrate dev --name init
```

验证输出显示 `Your database is now in sync with your schema.`

- [ ] **Step 5：创建 seed 脚本**

`apps/backend/prisma/seed.ts`（可选，首期可以空或只创建一个测试用户）：

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seed: No initial data needed. Migration script will handle data import.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6：Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat: add Prisma schema and initial migration for V2"
```

### Task 3.2：实现 Auth 模块

**Files:**
- Create: `apps/backend/src/auth/auth.module.ts`
- Create: `apps/backend/src/auth/auth.controller.ts`
- Create: `apps/backend/src/auth/auth.service.ts`
- Create: `apps/backend/src/auth/auth.dto.ts`
- Create: `apps/backend/src/auth/jwt.strategy.ts`
- Create: `apps/backend/src/auth/auth.guard.ts`
- Create: `apps/backend/src/auth/current-user.decorator.ts`
- Create: `apps/backend/test/auth.e2e-spec.ts`（可选，先保证编译）

**Interfaces:**
- Produces: `JwtAuthGuard` — 全局 JWT 认证守卫
- Produces: `CurrentUser` — 从请求中提取当前用户装饰器
- Produces: `AuthController` — `/auth/*` 端点
- Produces: `AuthService` — 注册、登录、刷新、登出逻辑

**描述：** 实现完整的 auth 模块：注册（Argon2 哈希）、登录（JWT access + refresh token）、refresh token 轮换、登出（吊销 refresh token）。

- [ ] **Step 1：创建 `src/auth/auth.dto.ts`**

```typescript
import { IsEmail, MinLength, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterRequest {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @MinLength(8) password: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() displayName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() baseCurrency?: string;
}

export class LoginRequest {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class RefreshRequest {
  @ApiProperty() @IsString() refreshToken: string;
}

export class LogoutRequest {
  @ApiProperty() @IsString() refreshToken: string;
}

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName?: string;
  @ApiProperty() baseCurrency: string;
  @ApiProperty() createdAt: string;
}

export class AuthResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty() user: UserDto;
}
```

- [ ] **Step 2：创建 `src/auth/auth.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuid } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { RegisterRequest, LoginRequest, AuthResponse, UserDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(req: RegisterRequest): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: req.email } });
    if (existing) {
      throw new AppError(ErrorCode.CONFLICT, 'Email already registered');
    }

    const passwordHash = await argon2.hash(req.password);
    const user = await this.prisma.user.create({
      data: {
        email: req.email,
        passwordHash,
        displayName: req.displayName || null,
        baseCurrency: req.baseCurrency || 'CNY',
      },
    });

    return this.generateAuthResponse(user);
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: req.email } });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, req.password);
    if (!valid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid email or password');
    }

    return this.generateAuthResponse(user);
  }

  async refresh(req: { refreshToken: string }): Promise<AuthResponse> {
    const tokenHash = this.hashToken(req.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // 如果 token 已过期但未吊销，也清理掉
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
      }
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    // 吊销旧 token（轮换）
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'User not found');
    }

    return this.generateAuthResponse(user);
  }

  async logout(userId: string, req: { refreshToken: string }): Promise<void> {
    const tokenHash = this.hashToken(req.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async generateAuthResponse(user: any): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      baseCurrency: user.baseCurrency,
      createdAt: user.createdAt.toISOString(),
    };

    return { accessToken, refreshToken, user: userDto };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('base64');
  }
}
```

- [ ] **Step 3：创建 `src/auth/jwt.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 4：创建 `src/auth/auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 5：创建 `src/auth/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // { userId, email }
  },
);
```

- [ ] **Step 6：创建 `src/auth/auth.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterRequest, LoginRequest, RefreshRequest, LogoutRequest, AuthResponse } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() req: RegisterRequest): Promise<AuthResponse> {
    return this.authService.register(req);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() req: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(req);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() req: RefreshRequest): Promise<AuthResponse> {
    return this.authService.refresh(req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: any, @Body() req: LogoutRequest): Promise<void> {
    return this.authService.logout(user.userId, req);
  }
}
```

- [ ] **Step 7：创建 `src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, PassportModule],
})
export class AuthModule {}
```

- [ ] **Step 8：验证 auth 模块编译通过**

```bash
cd apps/backend
npm run build
```

- [ ] **Step 9：Commit**

```bash
git add apps/backend/src/auth/
git commit -m "feat: implement auth module (register/login/refresh/logout) with Argon2 + JWT"
```

### Task 3.3：实现 Users 模块

**Files:**
- Create: `apps/backend/src/users/users.module.ts`
- Create: `apps/backend/src/users/users.controller.ts`
- Create: `apps/backend/src/users/users.service.ts`

**Interfaces:**
- Produces: `UsersController` — `GET /users/me`

**描述：** 简单的用户信息端点。

- [ ] **Step 1：创建 `src/users/users.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserDto } from '../auth/auth.dto';
import { AppError, ErrorCode } from '../common/error.codes';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, 'User not found');
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      baseCurrency: user.baseCurrency,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2：创建 `src/users/users.controller.ts`**

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UserDto } from '../auth/auth.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any): Promise<UserDto> {
    return this.usersService.getMe(user.userId);
  }
}
```

- [ ] **Step 3：创建 `src/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 4：Commit**

```bash
git add apps/backend/src/users/
git commit -m "feat: implement users module (GET /users/me)"
```

### Task 3.4：实现 Finance 模块（资产 + 负债）

**Files:**
- Create: `apps/backend/src/finance/finance.module.ts`
- Create: `apps/backend/src/finance/finance.controller.ts`
- Create: `apps/backend/src/finance/finance.service.ts`
- Create: `apps/backend/src/finance/finance.dto.ts`

**Interfaces:**
- Produces: `FinanceController` — 资产/负债 CRUD 端点
- Produces: `FinanceService` — 资产/负债业务逻辑
- Consumes: `PrismaService`, `JwtAuthGuard`

**描述：** 实现资产和负债的完整 CRUD（GET list、POST create、PATCH update、DELETE soft-delete）。金额在 API 中以字符串形式序列化。

- [ ] **Step 1：创建 `src/finance/finance.dto.ts`**

```typescript
import { IsString, IsOptional, IsNumber, IsDateString, Min, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

// --- Enums ---
export const ASSET_TYPES = ['cash', 'deposit', 'fixedIncome', 'fund', 'stock', 'commodity', 'foreignCurrency', 'housingFund', 'other'] as const;
export const LIABILITY_TYPES = ['creditCard', 'mortgage', 'consumerLoan', 'personalLoan', 'other'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export const LIQUIDITY_LEVELS = ['high', 'medium', 'low'] as const;
export const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR'] as const;

// --- Response DTOs (strings for decimal) ---
export class AssetResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() name: string;
  @ApiProperty() type: string;
  @ApiProperty() platform?: string;
  @ApiProperty() currency: string;
  @ApiProperty() amount: string; // decimal as string
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

// --- Request DTOs ---
export class CreateAssetRequest {
  @ApiProperty() @IsString() clientUid: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() platform?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsString() amount: string; // decimal string
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
```

- [ ] **Step 2：创建 `src/finance/finance.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import {
  AssetResponse, LiabilityResponse,
  CreateAssetRequest, UpdateAssetRequest,
  CreateLiabilityRequest, UpdateLiabilityRequest,
} from './finance.dto';

// 辅助：将 Prisma Decimal 转为字符串
function decToStr(d: Decimal | null | undefined): string | undefined {
  return d ? d.toString() : undefined;
}

function toAssetResponse(a: any): AssetResponse {
  return {
    ...a,
    amount: a.amount.toString(),
    shareCount: decToStr(a.shareCount),
    clientUpdatedAt: a.clientUpdatedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    deletedAt: a.deletedAt?.toISOString() || undefined,
  };
}

function toLiabilityResponse(l: any): LiabilityResponse {
  return {
    ...l,
    amount: l.amount.toString(),
    dueDate: l.dueDate?.toISOString() || undefined,
    clientUpdatedAt: l.clientUpdatedAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    deletedAt: l.deletedAt?.toISOString() || undefined,
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
        userId,
        clientUid: req.clientUid,
        name: req.name,
        type: req.type,
        platform: req.platform || null,
        currency: req.currency || 'CNY',
        amount: new Decimal(req.amount),
        shareCount: req.shareCount ? new Decimal(req.shareCount) : null,
        risk: req.risk || 'medium',
        liquidity: req.liquidity || 'medium',
        note: req.note || null,
        clientUpdatedAt: new Date(req.clientUpdatedAt),
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
        userId,
        clientUid: req.clientUid,
        name: req.name,
        type: req.type,
        currency: req.currency || 'CNY',
        amount: new Decimal(req.amount),
        dueDate: req.dueDate ? new Date(req.dueDate) : null,
        note: req.note || null,
        clientUpdatedAt: new Date(req.clientUpdatedAt),
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
```

- [ ] **Step 3：创建 `src/finance/finance.controller.ts`**

```typescript
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
```

- [ ] **Step 4：创建 `src/finance/finance.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
```

- [ ] **Step 5：Commit**

```bash
git add apps/backend/src/finance/
git commit -m "feat: implement finance module (asset/liability CRUD)"
```

### Task 3.5：实现 Snapshots 模块

**Files:**
- Create: `apps/backend/src/snapshots/snapshots.module.ts`
- Create: `apps/backend/src/snapshots/snapshots.controller.ts`
- Create: `apps/backend/src/snapshots/snapshots.service.ts`
- Create: `apps/backend/src/snapshots/snapshots.dto.ts`

**Interfaces:**
- Produces: `SnapshotsController` — `GET /snapshots`, `POST /snapshots`, `GET /snapshots/:id`
- Consumes: `PrismaService`, `JwtAuthGuard`

**描述：** 实现快照列表、创建和详情查询。创建快照时需要计算当前净资产并生成快照明细。

- [ ] **Step 1：创建 `src/snapshots/snapshots.dto.ts`**

```typescript
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
  @ApiProperty() items?: SnapshotItemResponse[];
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
```

- [ ] **Step 2：创建 `src/snapshots/snapshots.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../common/prisma.service';
import { AppError, ErrorCode } from '../common/error.codes';
import { CreateSnapshotRequest, SnapshotResponse, SnapshotItemResponse } from './snapshots.dto';

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
        id: i.id,
        clientUid: i.clientUid,
        sourceName: i.sourceName,
        amount: i.amount.toString(),
        category: i.category || undefined,
        risk: i.risk || undefined,
        liquidity: i.liquidity || undefined,
        isLiability: i.isLiability,
      })),
    };
  }

  async create(userId: string, req: CreateSnapshotRequest): Promise<SnapshotResponse> {
    // 计算当前净资产
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
        userId,
        clientUid: req.clientUid,
        snapshotDate: new Date(req.snapshotDate),
        totalAssets,
        totalLiabilities,
        netWorth,
        currency,
        note: req.note || null,
        clientUpdatedAt: new Date(),
      },
    });

    // 创建快照明细
    const items = [...assets.map(a => ({
      userId,
      snapshotClientUid: snapshot.clientUid,
      clientUid: uuid(),
      sourceName: a.name,
      amount: a.amount,
      category: a.type,
      risk: a.risk,
      liquidity: a.liquidity,
      isLiability: false,
    })), ...liabilities.map(l => ({
      userId,
      snapshotClientUid: snapshot.clientUid,
      clientUid: uuid(),
      sourceName: l.name,
      amount: l.amount,
      category: l.type,
      risk: null,
      liquidity: null,
      isLiability: true,
    }))];

    if (items.length > 0) {
      await this.prisma.snapshotItem.createMany({ data: items });
    }

    return this.getById(userId, snapshot.id);
  }
}
```

- [ ] **Step 3：创建 `src/snapshots/snapshots.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SnapshotsService } from './snapshots.service';
import { CreateSnapshotRequest, SnapshotResponse } from './snapshots.dto';

@ApiTags('Snapshots')
@Controller('snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private snapshotsService: SnapshotsService) {}

  @Get()
  list(@CurrentUser() user: any): Promise<SnapshotResponse[]> {
    return this.snapshotsService.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() req: CreateSnapshotRequest): Promise<SnapshotResponse> {
    return this.snapshotsService.create(user.userId, req);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string): Promise<SnapshotResponse> {
    return this.snapshotsService.getById(user.userId, id);
  }
}
```

- [ ] **Step 4：创建 `src/snapshots/snapshots.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { SnapshotsController } from './snapshots.controller';
import { SnapshotsService } from './snapshots.service';

@Module({
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
```

- [ ] **Step 5：Commit**

```bash
git add apps/backend/src/snapshots/
git commit -m "feat: implement snapshots module (list/create/detail)"
```

### Task 3.6：实现 Reports、Exchange、Stats 和 AI 模块

**Files:**
- Create: `apps/backend/src/reports/reports.module.ts`, `reports.controller.ts`, `reports.service.ts`, `reports.dto.ts`
- Create: `apps/backend/src/exchange/exchange.module.ts`, `exchange.controller.ts`, `exchange.service.ts`, `exchange.dto.ts`
- Create: `apps/backend/src/stats/stats.module.ts`, `stats.controller.ts`, `stats.service.ts`, `stats.dto.ts`
- Create: `apps/backend/src/ai/ai.module.ts`, `ai.controller.ts`, `ai.service.ts`, `ai.dto.ts`, `deepseek.client.ts`

**Interfaces:**
- Produces: `ReportsController` — `GET /reports`, `GET /reports/latest-ai-review`
- Produces: `ExchangeController` — `GET /exchange/rates`, `POST /exchange/rates`
- Produces: `StatsController` — `GET /stats/overview`
- Produces: `AiController` — `POST /ai/reviews`

**描述：** 实现剩余的 4 个模块。Reports 和 AI 紧密关联（AI review 完成后生成 Report）。Exchange 和 Stats 较独立。

由于本计划已经很长，这 4 个模块的完整代码简化为关键结构，具体实现模式与前面的模块一致。

- [ ] **Step 1：创建 Reports 模块**

`src/reports/reports.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class ReportResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() title: string;
  @ApiProperty() reportType: string;
  @ApiProperty() markdown: string;
  @ApiProperty() summaryJson?: any;
  @ApiProperty() generatedAt: string;
}
```

`src/reports/reports.service.ts` — 提供 `list()` 和 `getLatestAiReview()` 方法，从 Prisma 查询 Report 表。

`src/reports/reports.controller.ts` — `GET /reports`（列出所有报告），`GET /reports/latest-ai-review`（获取最新 AI review 报告）。

- [ ] **Step 2：创建 Exchange 模块**

`src/exchange/exchange.dto.ts` — `ExchangeRateResponse`（baseCurrency, targetCurrency, rate as string, rateDate, source）。

`src/exchange/exchange.service.ts` — 提供 `getRates()` 和 `setRate()` 方法。首版不需要外部 API 自动获取，只做手动汇率管理。

`src/exchange/exchange.controller.ts` — `GET /exchange/rates?base=&date=`，`POST /exchange/rates`。

- [ ] **Step 3：创建 Stats 模块**

`src/stats/stats.dto.ts`:
```typescript
export class OverviewResponse {
  baseCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  assetsByCurrency: CurrencyBreakdown[];
  liabilitiesByCurrency: CurrencyBreakdown[];
  topAssets: AccountBreakdown[];
  topLiabilities: AccountBreakdown[];
}

export class CurrencyBreakdown {
  currency: string;
  originalAmount: string;
  convertedAmount?: string;
  rate?: string;
}

export class AccountBreakdown {
  clientUid: string;
  name: string;
  currency: string;
  originalAmount: string;
}
```

`src/stats/stats.service.ts` — 汇总用户的资产和负债，按币种分组，取 top 5。

`src/stats/stats.controller.ts` — `GET /stats/overview`。

- [ ] **Step 4：创建 AI 模块**

`src/ai/ai.dto.ts`:
```typescript
export class AIReviewResponse {
  clientUid: string;
  summary: string;
  highlights: string[];
  risks: string[];
  nextActions: string[];
  disclaimer: string;
  model: string;
  generatedAt: string;
}
```

`src/ai/deepseek.client.ts` — HTTP 客户端调用 DeepSeek chat completions API。

`src/ai/ai.service.ts` — `generateReview()` 方法：
1. 查询用户的资产、负债、快照数据
2. 构建 `FinancialContext` JSON
3. 调用 DeepSeekClient
4. 解析返回的 JSON 为 `AIReviewResponse`
5. 将结果保存为 `Report`（reportType: 'ai_review'）

`src/ai/ai.controller.ts` — `POST /ai/reviews`（生成新 review）。

- [ ] **Step 5：编译验证所有模块**

```bash
cd apps/backend
npm run build
```

修复所有编译错误。

- [ ] **Step 6：Commit**

```bash
git add apps/backend/src/reports/ apps/backend/src/exchange/ apps/backend/src/stats/ apps/backend/src/ai/
git commit -m "feat: implement reports, exchange, stats, and AI modules"
```

---

## 阶段 4：数据迁移

### Task 4.1：编写旧库到新库的迁移脚本

**Files:**
- Create: `apps/backend/prisma/migrate-old-data.ts`

**描述：** 编写一次性迁移脚本，从旧库（rice_finance）读取数据，插入到新库（rice_finance_v2）。迁移脚本需要输出每张表的行数和关键财务合计。

- [ ] **Step 1：安装 pg 驱动用于直连旧库**

```bash
cd apps/backend
npm install pg
npm install -D @types/pg
```

- [ ] **Step 2：编写迁移脚本**

`apps/backend/prisma/migrate-old-data.ts`:

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { Decimal } from '@prisma/client/runtime/library';

// 新库 Prisma client
const prisma = new PrismaClient();

// 旧库连接（只读）
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

  let usersMigrated = 0;
  for (const u of oldUsers) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        passwordHash: u.password_hash,
        displayName: u.display_name,
        baseCurrency: u.base_currency,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
      update: {
        email: u.email,
        passwordHash: u.password_hash,
      },
    });
    usersMigrated++;
  }
  console.log(`Users migrated: ${usersMigrated}`);

  // --- Assets ---
  const { rows: oldAssets } = await oldDb.query<OldAsset>('SELECT * FROM asset_accounts ORDER BY created_at');
  console.log(`Found ${oldAssets.length} assets in old DB`);

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

  // Count checks
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

  // Financial sum checks (per user)
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
```

- [ ] **Step 3：添加 migration 脚本到 package.json**

在 `apps/backend/package.json` 的 scripts 中添加：
```json
"migrate:old-data": "ts-node -r tsconfig-paths/register prisma/migrate-old-data.ts"
```

- [ ] **Step 4：Commit**

```bash
git add apps/backend/prisma/migrate-old-data.ts apps/backend/package.json
git commit -m "feat: add old-to-V2 data migration script with row count and financial validation"
```

### Task 4.2：执行数据迁移

**描述：** 在确保旧库已备份的前提下，执行迁移脚本。

- [ ] **Step 1：确认旧库备份已完成（Task 0.2 已做）**

```bash
ls -la backups/ricefinance-before-ts-v2.sql
wc -l backups/ricefinance-before-ts-v2.sql
```

- [ ] **Step 2：设置环境变量**

```bash
cd apps/backend
export OLD_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rice_finance"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rice_finance_v2"
```

- [ ] **Step 3：执行迁移**

```bash
npx ts-node -r tsconfig-paths/register prisma/migrate-old-data.ts
```

- [ ] **Step 4：检查输出**

验证：
- 所有表行数一致（✓ 而不是 ✗ MISMATCH）
- 每个用户的财务合计与 Task 0.1 Step 4 中记录的一致
- 没有异常错误

- [ ] **Step 5：在 Prisma Studio 中抽查数据**

```bash
npx prisma studio
# 在浏览器中打开，抽查几张表的数据是否正确
```

- [ ] **Step 6：Commit 迁移记录（可选）**

如果迁移脚本需要微调，记录变更并提交。

---

## 阶段 5：Web 客户端切换

### Task 5.1：生成 V2 API typed client

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/api/v2-client.ts`

**描述：** 使用 NestJS Swagger 生成 OpenAPI spec，然后在 Web 端生成 typed client。如果 Swagger 集成在首期受阻，改为手写 typed client（基于 V2 DTO 定义，不自行创造类型）。

- [ ] **Step 1：在 NestJS 后端配置 Swagger**

修改 `apps/backend/src/main.ts`，添加 Swagger 设置：

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// 在 bootstrap() 中添加：
const config = new DocumentBuilder()
  .setTitle('RiceFinance API V2')
  .setDescription('RiceFinance TypeScript Backend V2 API')
  .setVersion('2.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

- [ ] **Step 2：安装 openapi-typescript（Web 端）**

```bash
cd apps/web
npm install -D openapi-typescript
```

- [ ] **Step 3：生成类型**

```bash
# 从后端 Swagger JSON 生成类型
npx openapi-typescript http://localhost:3000/api-docs-json -o src/api/v2-types.ts
```

备注：如果 openapi-typescript 流程在首期不通（比如后端未完全启动），则先手写 V2 类型。

- [ ] **Step 4：创建手写 V2 类型（备用方案）**

如果 Swagger 生成不可用，创建 `apps/web/src/api/v2-types.ts`，基于 V2 API 的 DTO 定义手写类型。关键类型包括：

```typescript
// Auth
export interface V2RegisterRequest { email: string; password: string; displayName?: string; baseCurrency?: string; }
export interface V2LoginRequest { email: string; password: string; }
export interface V2RefreshRequest { refreshToken: string; }
export interface V2AuthResponse { accessToken: string; refreshToken: string; user: V2UserDto; }
export interface V2UserDto { id: string; email: string; displayName?: string; baseCurrency: string; createdAt: string; }

// Assets
export interface V2AssetResponse { id: string; clientUid: string; name: string; type: string; platform?: string; currency: string; amount: string; shareCount?: string; risk: string; liquidity: string; note?: string; clientUpdatedAt: string; createdAt: string; updatedAt: string; deletedAt?: string; version: number; }
export interface V2CreateAssetRequest { clientUid: string; name: string; type: string; platform?: string; currency?: string; amount: string; shareCount?: string; risk?: string; liquidity?: string; note?: string; clientUpdatedAt: string; }
export interface V2UpdateAssetRequest { name?: string; type?: string; platform?: string; currency?: string; amount?: string; shareCount?: string; risk?: string; liquidity?: string; note?: string; clientUpdatedAt: string; }

// Liabilities (similar pattern)
export interface V2LiabilityResponse { id: string; clientUid: string; name: string; type: string; currency: string; amount: string; dueDate?: string; note?: string; clientUpdatedAt: string; createdAt: string; updatedAt: string; deletedAt?: string; version: number; }
// ... etc

// Stats
export interface V2OverviewResponse { baseCurrency: string; totalAssets: string; totalLiabilities: string; netWorth: string; assetsByCurrency: V2CurrencyBreakdown[]; liabilitiesByCurrency: V2CurrencyBreakdown[]; topAssets: V2AccountBreakdown[]; topLiabilities: V2AccountBreakdown[]; }
export interface V2CurrencyBreakdown { currency: string; originalAmount: string; convertedAmount?: string; rate?: string; }
export interface V2AccountBreakdown { clientUid: string; name: string; currency: string; originalAmount: string; }

// Snapshots
export interface V2SnapshotResponse { id: string; clientUid: string; snapshotDate: string; totalAssets: string; totalLiabilities: string; netWorth: string; currency: string; note?: string; clientUpdatedAt: string; createdAt: string; version: number; items?: V2SnapshotItemResponse[]; }
export interface V2SnapshotItemResponse { id: string; clientUid: string; sourceName: string; amount: string; category?: string; risk?: string; liquidity?: string; isLiability: boolean; }

// Reports / AI
export interface V2ReportResponse { id: string; clientUid: string; title: string; reportType: string; markdown: string; summaryJson?: any; generatedAt: string; }
export interface V2AIReviewResponse { clientUid: string; summary: string; highlights: string[]; risks: string[]; nextActions: string[]; disclaimer: string; model: string; generatedAt: string; }

// Unified error
export interface V2ApiError { error: { code: string; message: string; details?: any[]; } }
```

- [ ] **Step 5：Commit**

```bash
git add apps/web/src/api/v2-types.ts apps/web/package.json
git commit -m "feat: add V2 API typed client foundation for Web"
```

### Task 5.2：重写 Web API 客户端

**Files:**
- Modify: `apps/web/src/api/client.ts`（或创建新的 `apps/web/src/api/v2-client.ts`）

**描述：** 重写 Web 的 API 客户端，移除对 `/api/v1` 和 sync 的依赖，改为调用 V2 资源 API。

- [ ] **Step 1：创建新的 V2 API 客户端**

`apps/web/src/api/v2-client.ts`:

```typescript
import type {
  V2AuthResponse, V2RegisterRequest, V2LoginRequest, V2RefreshRequest,
  V2AssetResponse, V2CreateAssetRequest, V2UpdateAssetRequest,
  V2LiabilityResponse, V2CreateLiabilityRequest, V2UpdateLiabilityRequest,
  V2SnapshotResponse, V2SnapshotResponse as V2SnapshotDetail,
  V2OverviewResponse, V2ReportResponse, V2AIReviewResponse,
  V2ApiError,
} from './v2-types';

const BASE = '/api/v2';

// --- Token Management ---
const AUTH_KEY = 'rice_auth_v2';

interface StoredAuth { accessToken: string; refreshToken: string; user: any; }

export function getStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredAuth(auth: StoredAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

// --- Auto-refresh ---
let refreshPromise: Promise<StoredAuth | null> | null = null;

async function refreshTokens(): Promise<StoredAuth | null> {
  const stored = getStoredAuth();
  if (!stored?.refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');
    const auth: V2AuthResponse = await res.json();
    const newAuth = { accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user };
    setStoredAuth(newAuth);
    return newAuth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

// --- Request helper ---
let onAuthExpired: (() => void) | null = null;
let onError: ((msg: string) => void) | null = null;

export function setAuthExpiredHandler(fn: () => void) { onAuthExpired = fn; }
export function setErrorHandler(fn: (msg: string) => void) { onError = fn; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const stored = getStoredAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (stored?.accessToken) {
    headers['Authorization'] = `Bearer ${stored.accessToken}`;
  }

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && stored?.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshTokens();
    }
    const newAuth = await refreshPromise;
    refreshPromise = null;

    if (newAuth) {
      headers['Authorization'] = `Bearer ${newAuth.accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      onAuthExpired?.();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err: V2ApiError = await res.json();
      msg = err.error?.message || msg;
    } catch {}
    // Logout on auth errors
    if (res.status === 401) {
      clearStoredAuth();
      onAuthExpired?.();
    }
    onError?.(msg);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth API ---
export const auth = {
  register: (data: V2RegisterRequest) =>
    request<V2AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: V2LoginRequest) =>
    request<V2AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  refresh: (data: V2RefreshRequest) =>
    request<V2AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify(data) }),
  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => request<any>('/users/me'),
};

// --- Finance API ---
export const finance = {
  listAssets: () => request<V2AssetResponse[]>('/finance/assets'),
  createAsset: (data: V2CreateAssetRequest) =>
    request<V2AssetResponse>('/finance/assets', { method: 'POST', body: JSON.stringify(data) }),
  updateAsset: (id: string, data: V2UpdateAssetRequest) =>
    request<V2AssetResponse>(`/finance/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAsset: (id: string) =>
    request<{ ok: boolean }>(`/finance/assets/${id}`, { method: 'DELETE' }),

  listLiabilities: () => request<V2LiabilityResponse[]>('/finance/liabilities'),
  createLiability: (data: V2CreateLiabilityRequest) =>
    request<V2LiabilityResponse>('/finance/liabilities', { method: 'POST', body: JSON.stringify(data) }),
  updateLiability: (id: string, data: V2UpdateLiabilityRequest) =>
    request<V2LiabilityResponse>(`/finance/liabilities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLiability: (id: string) =>
    request<{ ok: boolean }>(`/finance/liabilities/${id}`, { method: 'DELETE' }),
};

// --- Snapshots API ---
export const snapshots = {
  list: () => request<V2SnapshotResponse[]>('/snapshots'),
  create: (data: { clientUid: string; snapshotDate: string; note?: string; currency?: string }) =>
    request<V2SnapshotDetail>('/snapshots', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id: string) => request<V2SnapshotDetail>(`/snapshots/${id}`),
};

// --- Stats API ---
export const stats = {
  overview: () => request<V2OverviewResponse>('/stats/overview'),
};

// --- Reports / AI API ---
export const ai = {
  latestReview: () => request<V2ReportResponse | null>('/reports/latest-ai-review'),
  generateReview: () => request<V2AIReviewResponse>('/ai/reviews', { method: 'POST' }),
};
```

- [ ] **Step 2：更新 Vite 代理配置**

修改 `apps/web/vite.config.ts`：
```typescript
server: {
  proxy: {
    '/api/v2': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 3：Commit**

```bash
git add apps/web/src/api/v2-client.ts apps/web/vite.config.ts
git commit -m "feat: rewrite Web API client for V2 backend"
```

### Task 5.3：改造 Web AppContext 和页面

**Files:**
- Modify: `apps/web/src/store/AppContext.tsx`
- Modify: `apps/web/src/pages/AuthPage.tsx`
- Modify: `apps/web/src/pages/OverviewPage.tsx`
- Modify: `apps/web/src/pages/AssetsPage.tsx`
- Modify: `apps/web/src/pages/SnapshotsPage.tsx`
- Modify: `apps/web/src/pages/AIPage.tsx`
- Modify: `apps/web/src/App.tsx`

**描述：** 将 Web 端所有页面从旧 API（`/api/v1/sync` 数据流）切换到 V2 API（资源 CRUD）。这是工作量最大的任务。

- [ ] **Step 1：改造 AppContext**

将 `AppContext` 从 "sync push/pull" 模型改为 "资源 CRUD" 模型：

关键改动：
- `refresh()` 改为调用 `finance.listAssets()` + `finance.listLiabilities()` + `snapshots.list()`
- `addAsset()` 改为调用 `finance.createAsset()`
- `updateAsset()` 改为调用 `finance.updateAsset(id, data)`
- `removeAsset()` 改为调用 `finance.deleteAsset(id)` + 从本地状态中移除
- 移除所有 `sync.changes()` 和 `sync.push()` 调用
- 移除 `genClientUid()`（V2 后端自动生成 server ID，但 clientUid 仍需客户端生成）
- 数据模型从旧 `AssetDto`/`LiabilityDto` 改为 V2 类型
- 金额从 number 转为 string（V2 API 返回字符串）

**注意：** 这是个破坏性改动，所有消费页面的类型引用也会变化。具体实现约 150 行代码改动。

- [ ] **Step 2：改造 AuthPage**

关键改动：
- 调用 `auth.register()` / `auth.login()` 从 V2 client
- 成功后使用 `setStoredAuth()`（V2 版本）
- 适配 V2 的 `AuthResponse` 格式

- [ ] **Step 3：改造 OverviewPage**

关键改动：
- 调用 `stats.overview()`（V2 API）
- 金额字段改为解析字符串 → 显示
- 快照列表从 `snapshots.list()` 获取

- [ ] **Step 4：改造 AssetsPage**

关键改动：
- 资产列表从 V2 `finance.listAssets()` / `finance.listLiabilities()` 获取
- 新增/编辑/删除调用 V2 API
- 金额显示适配字符串格式

- [ ] **Step 5：改造 SnapshotsPage 和 AIPage**

- SnapshotsPage：调用 V2 `snapshots.list()` / `snapshots.create()` / `snapshots.getById()`
- AIPage：调用 V2 `ai.latestReview()` / `ai.generateReview()`

- [ ] **Step 6：改造 App.tsx 认证流程**

- `RequireAuth` 使用 V2 的 `getStoredAuth()`
- `onAuthExpired` 回调使用 V2 的 `setAuthExpiredHandler()`
- Toast 错误处理使用 V2 的 `setErrorHandler()`

- [ ] **Step 7：编译 Web 端，修复所有 TypeScript 错误**

```bash
cd apps/web
npm run build
# 或 npm run typecheck（如果有的话）
```

修复所有类型不匹配。

- [ ] **Step 8：启动 V2 后端 + Web，手动验证关键流程**

```bash
# Terminal 1: 启动后端
cd apps/backend
npm run start:dev

# Terminal 2: 启动 Web
cd apps/web
npm run dev
```

手动测试：
1. 登录 → 进入首页 → 看到迁移后的数据
2. 资产列表 → 新增资产 → 编辑资产 → 删除资产
3. 负债列表 → 同样的 CRUD 流程
4. 快照页面 → 查看快照 → 生成快照
5. AI 页面 → 查看已有报告

- [ ] **Step 9：Commit**

```bash
git add apps/web/src/
git commit -m "feat: migrate Web to V2 API (resource CRUD, remove old sync model)"
```

---

## 阶段 6：最终验收与清理

### Task 6.1：全链路验收测试

**描述：** 按照迁移方案第 16 节的验收标准，逐项确认。

- [ ] **Step 1：后端验收清单**

```text
[ ] apps/backend 已替换为 TypeScript 后端，可本地启动
[ ] V2 后端可连接 PostgreSQL（rice_finance_v2）
[ ] V2 auth 可正常注册、登录、刷新、登出
[ ] V2 可提供核心财务数据（assets/liabilities/snapshots/reports/rates）
[ ] 所有 API 输入有运行时校验（class-validator）
[ ] 金额以字符串形式在 API 中输出
[ ] 统一错误格式正确
```

- [ ] **Step 2：数据验收清单**

```text
[ ] 旧库 pg_dump 备份完成
[ ] 迁移使用新 V2 数据库完成
[ ] 用户数一致
[ ] 资产数一致
[ ] 负债数一致
[ ] 快照数一致
[ ] 报告数一致
[ ] 汇率数一致
[ ] 总资产一致
[ ] 总负债一致
[ ] 净资产一致
```

- [ ] **Step 3：Web 验收清单**

```text
[ ] Web 登录成功（V2 API）
[ ] Web 首页可见迁移后数据
[ ] Web 资产列表可见迁移后资产
[ ] Web 负债列表可见迁移后负债
[ ] 新增/编辑/删除资产可调用 V2 API
[ ] 新增/编辑/删除负债可调用 V2 API
[ ] AI 页面可读取或生成 V2 AI review
[ ] V2 API 错误可在 Web 中显示为可理解的信息
[ ] Web 不再调用旧 /api/v1、/sync/changes、/sync/push
```

- [ ] **Step 4：确认 Java 后端代码已完全移除**

```bash
find apps/backend -name "*.java" 2>/dev/null  # 应该无输出
find apps/backend -name "*.gradle" 2>/dev/null # 应该无输出
ls apps/backend/Dockerfile                      # 应该是新的 TS Dockerfile
```

### Task 6.2：更新项目文档

**Files:**
- Modify: `CLAUDE.md`（根目录）
- Create: `apps/backend/CLAUDE.md`（新的 TS 后端 CLAUDE.md）
- Modify: `apps/web/CLAUDE.md`

**描述：** 更新项目根和子工程的 CLAUDE.md，反映新的技术栈和架构。

- [ ] **Step 1：更新根 CLAUDE.md**

修改 `CLAUDE.md` 的技术栈表，将"当前后端原型"改为"当前后端"（NestJS + Prisma），移除 Java 相关描述。更新开发阶段 checklist。

- [ ] **Step 2：创建新的 `apps/backend/CLAUDE.md`**

包含：NestJS 架构描述、模块说明、Prisma 使用指南、开发命令、API 约定、错误格式。

- [ ] **Step 3：更新 `apps/web/CLAUDE.md`**

更新 API 层描述（V2 资源 API 替代旧 sync API），更新 Vite 代理配置说明。

- [ ] **Step 4：Commit 文档更新**

```bash
git add CLAUDE.md apps/backend/CLAUDE.md apps/web/CLAUDE.md
git commit -m "docs: update project documentation for TypeScript backend V2"
```

### Task 6.3：最终清理

**描述：** 检查并清理遗留问题。

- [ ] **Step 1：检查是否有遗留引用**

```bash
cd /Users/tanwentao/Documents/project/RiceFinance
# 搜索对旧 API 路径的引用
grep -r "/api/v1" apps/web/src/ --include="*.ts" --include="*.tsx"  || echo "No old API references found"
# 搜索对 Java 后端的引用
grep -r "Spring Boot\|spring boot\|Java.*backend" docs/ --include="*.md"  || echo "No Java backend references in docs"
```

- [ ] **Step 2：运行一次完整的后端测试**

```bash
cd apps/backend
npm test
```

- [ ] **Step 3：运行一次完整的 Web 构建**

```bash
cd apps/web
npm run build
```

确保无编译错误。

- [ ] **Step 4：更新 .gitignore**

确认 `apps/backend/.env` 被忽略（不应提交密钥），`backups/` 被忽略。

- [ ] **Step 5：最终 Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification for TypeScript backend V2 migration

Backend V2 is now the sole backend for RiceFinance.
- NestJS + Prisma + PostgreSQL
- JWT auth with Argon2 + refresh token rotation
- Resource-oriented REST API
- Web client fully migrated to V2 API
- All existing data migrated with validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 预估任务时间线

| 阶段 | 任务数 | 预估时间 |
|------|--------|----------|
| 阶段 0：备份与盘点 | 2 | 30 min |
| 阶段 1：设计与契约 | 2 | 30 min |
| 阶段 2：替换目录与骨架 | 3 | 45 min |
| 阶段 3：核心 API 实现 | 6 | 3-4 hours |
| 阶段 4：数据迁移 | 2 | 1 hour |
| 阶段 5：Web 客户端切换 | 3 | 2-3 hours |
| 阶段 6：验收与清理 | 3 | 45 min |
| **总计** | **21** | **约 8-10 hours** |
