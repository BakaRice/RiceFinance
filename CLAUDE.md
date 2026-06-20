# CLAUDE.md

本文件是 RiceFinance 项目的 AI 导航入口。它描述整个项目的结构、技术栈、产品方向和约定，让 AI（Claude Code）在任意子上下文中都能理解全局。

## 项目概述

RiceFinance（又名 RiceWorth）是一个**个人财务理解与 AI Agent 复盘工具**，定位 Apple 生态，覆盖 iPhone、iPad、Mac，并通过自建后端实现多端数据同步。

产品核心理念：**低频体检，非高频记账**。用户每月更新资产数据，生成净资产快照，导入或整理消费流水，通过 AI Agent 获取资产结构分析、消费习惯复盘、月度总结和下月关注点。

项目首先服务作者本人真实使用，其次作为学习 iOS、TypeScript、前端与 AI Agent 应用开发的长期项目。不要为了“功能完整”堆传统记账软件能力；优先做作者每月真的会打开使用的财务复盘闭环。

详细产品设计见 [docs/product-design.md](docs/product-design.md)。

## 仓库结构（AI 时代单仓架构）

```
RiceFinance/
├── CLAUDE.md              # ← 当前文件：AI 入口导航
├── apps/
│   ├── ios/               # SwiftUI + SwiftData iOS/iPadOS/Mac Catalyst
│   │   └── CLAUDE.md      # iOS 端架构与约定
│   ├── backend/           # NestJS + Prisma TypeScript 后端
│   │   └── CLAUDE.md      # 后端架构与约定
│   └── web/               # React + Vite + TypeScript 管理端
│       └── CLAUDE.md      # Web 端架构与约定
├── docs/                  # 唯一文档层（设计 + 产品 + 迭代）
│   ├── product-design.md  # 产品技术设计总文档
│   ├── RULE.md            # 设计文档命名规范（PRD / TDC）
│   ├── PRD/               # 产品设计方案
│   ├── TDC/               # 技术落地方案（含历史迭代）
│   └── assets/            # 文档用静态资源（图片等）
├── specs/                 # 跨端共享合约
│   ├── api/               # API 接口定义（OpenAPI / 手写）
│   └── dto/               # 跨端 DTO / 枚举定义
└── scripts/               # 工具脚本
```

## 技术栈总览

| 层 | 技术 | 说明 |
|----|------|------|
| iOS / Mac | SwiftUI, SwiftData, Charts, URLSession | Mac 通过 Catalyst 共用同一 target |
| 后端 | Node.js, NestJS, Prisma, PostgreSQL | JWT Auth、资源 CRUD、快照、统计、AI review |
| Web | React, Vite, TypeScript | 管理端与 TS 学习载体 |
| AI | DeepSeek API（当前）/ 其他模型可选 | AI Agent 财务分析、消费复盘与月报生成 |
| 部署 | Docker Compose, Caddy/Nginx | 自托管后端 |

## 产品方向

当前产品主线：

```text
我有什么：资产、负债、账户、币种、净资产
我怎么花：消费流水、消费主题、必要/弹性支出、消费习惯
我怎么变：月度快照、净资产趋势、结构变化
我要去哪：目标、决策辅助、下月关注点
```

第一阶段最重要的闭环：

```text
录入资产和负债
→ 生成本月净资产快照
→ AI 提出复盘问题
→ 用户补充本月上下文
→ AI 生成月度复盘
→ 保存 1-3 个下月关注点
→ 下个月继续追踪
```

消费方向可以逐步支持微信、支付宝、银行、信用卡、CSV/Excel/JSON 等流水导入，但目标是低频消费习惯复盘，而不是每天手工记账。

## 技术方向

后端已迁移到 NestJS + Prisma + TypeScript，采用资源导向 API 设计，移除旧 sync 模型。

```text
React / TypeScript Web
+ SwiftUI / SwiftData 客户端
+ TypeScript API / Agent Service
+ PostgreSQL
+ Zod / typed schema
```

选择 TypeScript 的主要原因：

- 前端、后端、脚本和共享类型统一；
- 对 AI Agent、tool calling、JSON schema、流式响应更自然；
- 对消费流水导入、清洗和解析更轻；
- 对作者本人学习 TS 和前端更有复利；
- 当前后端复杂度仍低，迁移成本可控。

## 核心设计约定

### 设计文档规范
- 所有设计、方案、迭代文档统一在 `docs/` 目录下管理
- PRD（产品设计）和 TDC（技术落地方案）使用 `yyyy-MM-dd-` 前缀
- 搁置的方案需在文档头部标注"历史探索方案"
- 设计文档随代码一起版本管理
- 详细命名约定见 [docs/RULE.md](docs/RULE.md)

### 子工程 AI 导航
- 每个 `apps/*` 子工程必须有 `CLAUDE.md`
- `CLAUDE.md` 不是人类 README，而是给 AI 的项目说明书：架构、命令、约定

### Specs 作为合约层
- `specs/api/` 和 `specs/dto/` 是跨端共享的结构化定义
- 后端、iOS、Web 都从这里理解接口约定

## 当前开发阶段

V0.1 Demo — 跑通最小闭环：资产录入 → 净资产计算 → 结构分析 → 月度快照 → AI 总结。

下一阶段产品重点：Agent 复盘闭环。

当前进度：
- [x] 产品设计文档
- [x] 后端骨架（Auth + Sync + Domain 实体）
- [x] 后端 AI 模块（DeepSeek 对接）
- [x] iOS 页面骨架（5 tab + SwiftData 本地模型）
- [x] Web 管理端基础页面与后端 API 对接
- [x] TypeScript 后端迁移
- [ ] Agent 复盘问题 / 用户回答 / 下月关注点
- [ ] 消费流水导入与消费习惯复盘
- [ ] Specs 层 API/DTO 定义

## 快速开始

```bash
# 后端
cd apps/backend
docker compose up postgres    # 启动 PostgreSQL
npx prisma migrate dev        # 数据库迁移
npm run start:dev             # 开发服务器

# iOS
open apps/ios/RiceFinance.xcodeproj

# Web
cd apps/web
npm install
npm run dev
```
