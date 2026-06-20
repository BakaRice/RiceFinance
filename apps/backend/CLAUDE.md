# RiceFinance Backend V2 — CLAUDE.md

TypeScript / NestJS / Prisma 后端，是 RiceFinance 的唯一后端实现。

## 技术栈

- 运行时：Node.js + TypeScript
- 框架：NestJS
- ORM：Prisma
- 数据库：PostgreSQL
- 认证：JWT access token + refresh token rotation (Argon2 密码哈希)
- 校验：class-validator + class-transformer
- AI：DeepSeek API
- 部署：Docker Compose

## 项目结构

```
apps/backend/
├── prisma/
│   ├── schema.prisma          # 数据模型（8 张表）
│   ├── migrations/            # Prisma 迁移文件
│   ├── seed.ts                # 种子数据
│   └── migrate-old-data.ts    # 旧 Java 后端数据迁移脚本
├── src/
│   ├── main.ts                # 入口：全局前缀 /api/v2，Swagger，CORS
│   ├── app.module.ts          # 根模块
│   ├── config/                # 环境变量配置
│   ├── common/                # 全局错误处理、PrismaService
│   ├── auth/                  # 认证：注册/登录/刷新/登出
│   ├── users/                 # 用户信息
│   ├── finance/               # 资产/负债 CRUD
│   ├── snapshots/             # 净资产快照
│   ├── reports/               # 报告（AI review 等）
│   ├── exchange/              # 汇率
│   ├── stats/                 # 财务统计总览
│   └── ai/                    # AI review 生成（DeepSeek）
├── test/
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

## 关键设计约定

- 所有金额在 PostgreSQL 中使用 Decimal，API 输出为字符串
- 所有 API 输入由 class-validator 做运行时校验
- 全局错误格式：`{ error: { code, message, details? } }`
- 所有 API 路径以 `/api/v2` 为前缀
- 客户端通过 `JwtAuthGuard` 认证
- `CurrentUser` 装饰器从请求中提取 `{ userId, email }`

## 常用命令

```bash
npm run start:dev          # 开发模式（热重载）
npm run build              # 生产构建
npm run start:prod         # 生产启动
npm test                   # 运行测试
npx prisma generate        # 生成 Prisma Client
npx prisma migrate dev     # 开发环境数据库迁移
npx prisma migrate deploy  # 生产环境数据库迁移
npx prisma studio          # 数据库可视化
npm run migrate:old-data   # 从旧库迁移数据
```

## 数据库

- 开发环境：`docker compose up postgres`，然后 `npx prisma migrate dev`
- 数据库名：`rice_finance_v2`
- 金额字段：Decimal(20,4)，API 输出为字符串
- 软删除：`deletedAt` 字段
- 乐观锁：`version` 字段

## API 概览

| 模块 | 端点 | 认证 |
|------|------|------|
| Auth | POST /auth/register, /auth/login, /auth/refresh | 公开 |
| Auth | POST /auth/logout | 需要 |
| Users | GET /users/me | 需要 |
| Finance | GET/POST /finance/assets, PATCH/DELETE /finance/assets/:id | 需要 |
| Finance | GET/POST /finance/liabilities, PATCH/DELETE /finance/liabilities/:id | 需要 |
| Snapshots | GET/POST /snapshots, GET /snapshots/:id | 需要 |
| Reports | GET /reports, GET /reports/latest-ai-review | 需要 |
| Stats | GET /stats/overview | 需要 |
| Exchange | GET/POST /exchange/rates | 需要 |
| AI | POST /ai/reviews | 需要 |
| Docs | GET /api/docs (Swagger UI) | 公开 |
