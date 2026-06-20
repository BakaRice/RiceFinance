# RiceFinance

[English](README.en.md)

RiceFinance 是一个个人财务管理与复盘工具，用于记录资产、负债、净资产快照，并通过 AI 辅助完成月度财务复盘。

这个项目更关注低频、长期的个人财务理解，而不是每天逐笔记账或做投资交易。它希望帮助回答这些问题：

- 我现在拥有什么？
- 我的净资产如何变化？
- 我的资产在风险、流动性和币种上是如何分布的？
- 下个月我应该重点关注什么？

## 项目结构

```text
apps/
  backend/   NestJS + Prisma 后端
  ios/       SwiftUI iOS 应用
  web/       React + TypeScript + Vite Web 应用
docs/        产品笔记、技术方案和设计文档
scripts/     项目脚本
specs/       API 和 DTO 规格
```

## 技术栈

- iOS：SwiftUI
- Web：React、TypeScript、Vite、React Router、TanStack Query、Recharts
- 后端：NestJS、Prisma、PostgreSQL、JWT 认证
- AI 复盘：兼容 DeepSeek 的聊天 API 配置

## 本地启动

### 后端

```bash
cd apps/backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

后端会读取 `apps/backend/.env` 中的配置。不要提交真实密钥。

### Web

```bash
cd apps/web
npm install
npm run dev
```

Web 应用使用 Vite 进行本地开发。

### iOS

用 Xcode 打开 `apps/ios/RiceFinance.xcodeproj`，然后从 Xcode 运行应用。

## 环境变量

后端环境变量记录在 `apps/backend/.env.example`，包括：

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `CORS_ORIGINS`
- `DEFAULT_BASE_CURRENCY`

本地和生产环境都应该使用足够强的密钥。示例文件只包含占位值和本地默认值。

## 安全说明

- 真实 `.env` 文件已被 Git 忽略。
- `backups/` 下的本地备份和数据库 dump 已被 Git 忽略。
- 构建产物、依赖目录、IDE 文件和本地应用状态已被 Git 忽略。
- 不要提交个人财务导出、生产数据库 dump、API Key、Token 或私有凭据。

## 当前状态

这是一个持续迭代中的个人项目。当前方向是以 TypeScript 后端为核心，配合 Web 和 iOS 客户端，并把 AI 辅助月度财务复盘作为核心工作流。
