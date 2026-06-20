# RiceFinance TypeScript 后端 V2 迁移技术方案

> 日期：2026-06-20
> 状态：已确认技术方向的设计方案
> 目标读者：项目作者、后续执行模型、未来维护者

---

## 1. 目标

为 RiceFinance 建设一套新的 TypeScript 后端，并将现有 PostgreSQL 数据一次性迁移到新后端使用的数据结构中。

这次迁移不是把 Java 代码逐行翻译成 TypeScript。现有 Java 后端是已经验证过的业务原型，可以作为参考，但不应该限制 V2 后端的架构、API、模块边界和代码风格。

本次迁移唯一必须兼容的是：**现有数据需要保留**。

本次迁移也不需要保留 Java 后端目录作为过渡实现。Git 已经提供历史回滚能力，因此 V2 可以直接替换现有后端目录，让仓库在迁移完成后只保留一套后端代码。

## 2. 非目标

本次迁移不要求：

- 保留旧的 `/api/v1` API 契约；
- 保留 Java 后端的包结构和模块边界；
- 保持 Web 端代码不变；
- 保持 iOS 网络层代码不变；
- Java 后端和 TypeScript 后端长期并行运行；
- 在仓库中长期保留 Java 后端作为参考实现；
- 做双写或灰度迁移；
- 在本期实现消费流水导入；
- 在本期实现完整 Agent 月度复盘。

消费流水和 Agent 复盘是未来方向，本期只需要在架构上预留扩展空间，不展开具体实现。

## 3. 约束

- 现有数据重要，但数据量很小，预计 100 条以内；
- 可以做一次性离线迁移；
- 迁移完成后，TypeScript 后端成为唯一后端；
- 旧 Java 后端代码可以在迁移实施阶段直接删除，由 Git 历史负责回滚和追溯；
- Git 只能回滚代码，不能回滚数据库；任何数据库变更前必须先备份；
- 推荐使用新 V2 数据库迁移，不在旧库上直接原地改造；
- 数据库继续使用 PostgreSQL；
- 金额字段必须继续避免浮点精度问题；
- 未来消费流水属于高隐私数据，架构上需要提前意识到隐私边界，但本期不实现。

## 4. 推荐技术栈

优先选择主流、成熟、资料多、长期可预期的 TypeScript 后端生态，而不是小众轻量框架。

推荐技术栈：

- 运行时：Node.js；
- 语言：TypeScript；
- 后端框架：NestJS；
- ORM：Prisma；
- 数据库：PostgreSQL；
- 校验：NestJS DTO 校验，必要时结合 Zod 做共享 schema；
- 认证：JWT access token + refresh token rotation；
- 密码哈希：Argon2 或 bcrypt；
- 测试：Jest；
- 部署：Docker Compose。

选择理由：

- NestJS 生态成熟，资料多，长期可预期；
- NestJS 的 Module / Controller / Service / DI 结构接近 Java / Spring，迁移心智成本低；
- Prisma 的 TypeScript 类型体验好，PostgreSQL 支持成熟；
- 这套栈对 AI 编程助手也比较友好，示例多，结构清楚；
- 它不是最轻的方案，但更符合“稳、主流、可长期维护”的目标。

## 5. 仓库结构建议

TypeScript 后端直接替换现有 `apps/backend`。

建议结构：

```text
apps/
  backend/             # 新 TypeScript Backend V2，替代旧 Java 后端
    src/
      main.ts
      app.module.ts
      config/
      common/
      auth/
      users/
      finance/
      snapshots/
      reports/
      exchange/
      stats/
      ai/
      migration/
    prisma/
      schema.prisma
      migrations/
      seed.ts
    test/
    package.json
    tsconfig.json
    Dockerfile

  web/                 # React Web，后续改接 V2 API
  ios/                 # SwiftUI App，后续按 V2 API 改造网络层

specs/
  api/                 # 未来 API 契约
  dto/                 # 未来共享 DTO / schema
```

实施阶段可以直接删除 `apps/backend` 中的 Java / Gradle / Spring Boot 代码，再在同一路径下初始化 NestJS 后端。

删除范围应包括旧后端相关文件，例如：

- `src/main/java/`；
- `src/main/resources/`；
- `build.gradle`；
- `settings.gradle`；
- `gradlew`；
- `gradlew.bat`；
- `gradle/`；
- 旧 Java 后端的 `Dockerfile`；
- 旧 Java 后端的 `docker-compose.yml`；
- 旧 Java 后端 README / CLAUDE 中不再适用的内容。

实施时可以根据需要保留少量旧 schema 或 README 内容作为迁移参考，但最终 `apps/backend` 应呈现为纯 TypeScript 后端目录。

这样做的理由：

- 仓库中只有一个后端入口，认知负担更低；
- 不需要维护 `apps/api` 和 `apps/backend` 两套后端命名；
- 不需要设计任何过渡兼容层；
- 如果需要查看旧实现，可以通过 Git 历史回看；
- 更符合“旧契约可抛弃，数据必须保留”的迁移原则。

## 6. 模块边界

V2 后端应该按产品能力组织，而不是按 Java 包名复制。

### 6.1 `auth`

职责：

- 注册；
- 登录；
- 刷新 access token；
- 登出 / 吊销 refresh token；
- 密码哈希；
- JWT 签发与校验；
- Auth guard；
- 当前用户提取。

约束：

- refresh token 只在数据库中保存 hash；
- refresh token 刷新时需要轮换；
- 不保存明文 refresh token。

### 6.2 `users`

职责：

- 当前用户信息；
- 用户默认本位币；
- 用户展示名称。

首版保持简单即可。

### 6.3 `finance`

职责：

- 资产账户；
- 负债账户；
- 财务枚举；
- 核心财务状态 CRUD。

这个模块承接旧后端中一部分 `domain` 和 `sync` 能力，但不需要照搬旧结构。

### 6.4 `snapshots`

职责：

- 净资产快照；
- 快照明细；
- 快照历史。

月度快照是 RiceFinance 的核心机制，应保留为独立模块。

### 6.5 `reports`

职责：

- AI 复盘报告；
- Markdown 报告正文；
- 结构化报告摘要 JSON。

未来的月度复盘记录可以放在这里，也可以等功能明确后拆出 `reviews` 模块。

### 6.6 `exchange`

职责：

- 汇率；
- 手动汇率维护；
- 未来自动汇率服务接入。

首版只需要保留现有汇率数据和基础查询能力。

### 6.7 `stats`

职责：

- 财务总览；
- 币种拆分；
- Top 资产 / 负债账户；
- 其他只读统计。

这是读模型模块，应和写入模块分开。

### 6.8 `ai`

职责：

- AI review 编排；
- Prompt / context 构造；
- DeepSeek 或其他模型客户端；
- 生成报告。

本期只迁移现有 AI review 能力。Agent 式提问、回答、下月关注点追踪放到后续。

### 6.9 未来模块

预留但本期不实现：

- `spending`：微信、支付宝、银行、CSV 等消费流水导入；
- `reviews`：月度 Agent 复盘、问题、回答、下月关注点；
- `agent-memory`：长期偏好、重复关注点和个人财务记忆。

## 7. 数据模型策略

V2 使用 Prisma schema 作为后端数据模型的主要来源。

现有 schema 很简单，核心概念可以保留：

- 用户；
- refresh token；
- 资产账户；
- 负债账户；
- 净资产快照；
- 快照明细；
- 报告；
- 汇率。

不需要为了迁移 TypeScript 而过度重建领域模型。可以在命名和字段组织上做清理，但核心语义保持稳定。

### 7.1 金额字段

金额在 PostgreSQL 中继续使用 Decimal。

API 输出金额时应该继续使用字符串，而不是 JavaScript number。

这样可以延续当前行为，避免浮点精度问题。

### 7.2 ID

保留服务端 UUID 主键。

保留 `clientUid`。它对移动端离线编辑、未来同步和客户端生成记录仍然有价值。

### 7.3 软删除

同步类实体继续保留 `deletedAt`。

即使 V2 首版不照搬旧 sync API，软删除能力仍然有长期价值。

### 7.4 版本号

同步类实体继续保留 `version`。

V2 首版可以暂时不暴露完整冲突处理，但数据库层不应该移除这个能力。

## 8. 数据迁移策略

采用一次性离线迁移。

强烈建议使用“旧库只读 + 新库迁移”的方式，而不是在旧库上直接原地修改。

推荐数据库形态：

```text
rice_finance_old  # 旧数据库，只读保留和备份
rice_finance_v2   # 新数据库，由 Prisma migrations 管理
```

如果实际环境中数据库名不同，执行模型应以现有配置为准，但原则不变：**旧数据先备份，新结构在新库中创建，迁移脚本从旧库复制到新库。**

推荐流程：

1. 停止 Java 后端；
2. 备份现有 PostgreSQL 数据库；
3. 记录旧 schema 和少量样本数据，供迁移脚本校验；
4. 删除 `apps/backend` 下的 Java 后端代码；
5. 在 `apps/backend` 下初始化 NestJS + Prisma 后端；
6. 创建 V2 数据库；
7. 执行 Prisma migrations；
8. 实现核心 V2 API；
9. 执行旧库到新库的数据迁移脚本；
10. 校验行数和关键财务合计；
11. Web 改接 V2 API；
12. 启动 TypeScript 后端并完成端到端验收。

备份命令示例：

```bash
pg_dump "$OLD_DATABASE_URL" > backups/ricefinance-before-ts-v2.sql
```

执行模型可以根据本地实际数据库连接方式调整命令，但必须保留备份步骤。

由于数据量很小，迁移脚本可以写得直接、显式、容易检查。

### 8.1 迁移脚本位置

可选位置：

```text
apps/backend/src/migration/
```

或：

```text
apps/backend/prisma/migrate-old-data.ts
```

### 8.2 迁移脚本职责

迁移脚本应该：

- 连接旧数据库；
- 连接 V2 数据库；
- 迁移 users；
- 迁移 asset accounts；
- 迁移 liability accounts；
- 迁移 snapshots；
- 迁移 snapshot items；
- 迁移 reports；
- 迁移 exchange rates；
- 输出每张表的迁移行数；
- 输出关键财务合计校验结果。

迁移脚本不应该：

- 连接生产旧库后直接执行破坏性写操作；
- 在没有备份的情况下修改旧库；
- 静默吞掉迁移错误；
- 在行数或金额校验失败时继续宣称迁移成功。

### 8.3 认证数据迁移

推荐策略：

- 保留用户；
- 如果密码哈希算法兼容，可以保留 password hash；
- 不迁移 refresh token；
- 迁移后要求用户重新登录。

这样可以减少认证迁移复杂度，也避免旧 token 在新系统里继续有效。

## 9. API 设计方向

不为了减少客户端改动而保留 `/api/v1`。

V2 API 应该按 TypeScript / NestJS 的最佳实践重新设计。具体路径可以在实现计划中确定，但整体建议采用资源导向。

示例形态：

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me

GET    /finance/assets
POST   /finance/assets
PATCH  /finance/assets/:id
DELETE /finance/assets/:id

GET    /finance/liabilities
POST   /finance/liabilities
PATCH  /finance/liabilities/:id
DELETE /finance/liabilities/:id

GET  /snapshots
POST /snapshots
GET  /snapshots/:id

GET  /stats/overview

GET  /reports
GET  /reports/latest-ai-review
POST /ai/reviews

GET  /exchange/rates
POST /exchange/rates
```

旧的 `/sync/changes` 和 `/sync/push` 不需要机械保留。

如果 iOS 很快需要离线同步，应重新设计 V2 sync contract，而不是因为旧实现存在就照搬。

## 10. 客户端迁移策略

后端 V2 是 breaking change，因此前端改造必须作为本次迁移的一部分，而不是事后补丁。

Web 和 iOS 都可以在 V2 后端完成后机械改造，但 Web 当前已经依赖旧 Java API，因此本期迁移至少需要覆盖 Web 改造。iOS 当前主要是本地 SwiftData 流程，网络同步可以等需求明确后再接 V2。

不要为了减少客户端改动而扭曲后端设计。在 AI 辅助开发时代，机械性改造不是最可怕的成本，错误边界和旧契约负担才是更大的长期成本。

推荐顺序：

1. 建好 Backend V2 API；
2. 用测试和简单 API 请求验证；
3. 迁移现有数据；
4. Web 改接 V2 API；
5. iOS 等网络同步需求明确后再改接。

当前 Web 依赖旧后端的能力包括：

- auth；
- current user；
- sync；
- stats overview；
- AI review。

迁移时 Web 的手写类型可以逐步向共享 DTO / schema 靠拢。

### 10.1 Web 改造范围

当前 Web 端至少需要改造：

- `apps/web/src/api/client.ts`：重写 API client，移除旧 `/api/v1` 假设；
- `apps/web/src/types/index.ts`：替换旧 Java DTO 镜像类型；
- `apps/web/src/store/AppContext.tsx`：从旧 `sync.changes` / `sync.push` 数据流改成 V2 资源 API 数据流；
- 登录 / 注册页面：适配 V2 auth 响应格式；
- 首页 Dashboard：适配 V2 stats overview；
- 资产页面：改为调用 V2 asset / liability CRUD；
- 快照页面：改为调用 V2 snapshot API；
- AI 页面：改为调用 V2 AI review / reports API；
- 全局错误处理：适配 V2 统一错误格式。

旧 Web 的同步模型是：

```text
GET /sync/changes
POST /sync/push
```

V2 Web 首版建议改成更直接的资源模型：

```text
GET /finance/assets
POST /finance/assets
PATCH /finance/assets/:id
DELETE /finance/assets/:id

GET /finance/liabilities
POST /finance/liabilities
PATCH /finance/liabilities/:id
DELETE /finance/liabilities/:id
```

如果未来 iOS 需要完整离线同步，再单独设计 V2 sync API，不要让 Web 为旧 sync 模型继续买单。

### 10.2 Web 类型策略

不要继续让 Web 手写一份“与后端 DTO 保持一致”的孤立类型。

默认推荐：

```text
NestJS Swagger / OpenAPI
→ 生成 OpenAPI JSON
→ Web 使用 openapi-typescript 或类似工具生成类型
→ Web API client 基于生成类型封装
```

只有当 OpenAPI 生成在首期明显阻塞实现时，才允许临时手写 V2 类型。即便临时手写，也需要在后续计划中迁回 generated typed client。

备选优先级：

1. 后端通过 OpenAPI 暴露契约，Web 生成 typed client；
2. 或在 `packages/shared` / `specs/dto` 中维护共享 schema；
3. 如果首期为了速度继续手写类型，也必须以 V2 DTO 为准，并在后续计划中迁到共享契约。

这样可以减少后续接口漂移。

### 10.3 Web 数据流调整

旧 Web 当前在 `AppContext` 中维护 assets、liabilities、snapshots，并通过 sync push/pull 刷新。

V2 Web 可以先采用更简单的数据流：

```text
页面加载
→ 调用 V2 list API
→ 页面操作调用 create/update/delete API
→ 成功后重新拉取列表或局部更新本地状态
```

首期不需要为 Web 做复杂离线队列。

### 10.4 iOS 改造边界

iOS 当前可以继续保留本地 SwiftData 和 JSON/Vault 能力。

本次迁移方案只要求：

- 不再假设旧 `/api/v1/sync` 会长期存在；
- 后续 iOS 网络层接入 V2 时，应基于新契约重写；
- 如果需要离线同步，应单独设计 V2 sync contract。

也就是说，Web 改造是本期迁移的一部分；iOS 网络改造可以后移。

## 11. 测试策略

V2 最少需要覆盖：

- 注册 / 登录 / refresh / logout；
- 密码哈希；
- refresh token 轮换；
- asset CRUD；
- liability CRUD；
- snapshot 创建和查询；
- stats overview 合计；
- 金额按字符串输出；
- 迁移脚本行数校验；
- 迁移脚本财务合计校验。

Web 端最少需要覆盖：

- 登录成功后保存 token 并进入主界面；
- token 过期后的刷新或重新登录流程；
- 首页可以展示 V2 stats overview；
- 资产列表可以展示迁移后的资产；
- 负债列表可以展示迁移后的负债；
- 新增 / 编辑 / 删除资产可以调用 V2 API；
- 新增 / 编辑 / 删除负债可以调用 V2 API；
- AI 页面可以读取或生成 V2 AI review；
- V2 API 错误能在 Web 中显示为可理解的信息。

数据迁移后至少校验：

- 用户数量；
- 资产数量；
- 负债数量；
- 快照数量；
- 报告数量；
- 汇率数量；
- 每个用户迁移前后的总资产；
- 每个用户迁移前后的总负债；
- 每个用户迁移前后的净资产。

## 12. 错误处理

V2 应定义统一 API 错误格式。

示例：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

至少需要区分：

- 参数校验错误；
- 未登录；
- 无权限；
- 资源不存在；
- 冲突；
- 外部 AI 服务错误；
- 未预期的内部错误。

## 13. 配置

使用环境变量管理：

- database URL；
- JWT access token secret；
- JWT refresh token secret 或相关配置；
- token 过期时间；
- 密码哈希配置；
- AI provider API key；
- AI provider base URL；
- 默认本位币；
- CORS allowed origins。

不要在源码中写死开发密钥。

## 14. 迁移实施阶段

### 阶段 0：备份与旧系统盘点

- 停止 Java 后端或确保旧库只读；
- 使用 `pg_dump` 备份旧数据库；
- 记录旧数据库连接信息；
- 记录旧 schema；
- 抽取少量旧数据样本用于迁移后对照；
- 确认备份文件可用。

### 阶段 1：设计与契约

- 确认本方案；
- 明确 V2 模块边界；
- 起草 Prisma schema；
- 确定 API 路径和 DTO。
- 确定 OpenAPI / typed client 生成方案。

### 阶段 2：替换后端目录并建立 TS 骨架

- 删除 `apps/backend` 中的 Java / Gradle / Spring Boot 代码；
- 在 `apps/backend` 原地初始化 NestJS；
- 配置 Prisma；
- 配置环境变量；
- 配置全局校验、错误处理、认证 guard；
- 配置本地 Docker / Docker Compose。

### 阶段 3：Prisma schema 与核心 API

- 创建 V2 数据库；
- 创建 Prisma schema；
- 执行 Prisma migrations；
- 实现 users / auth；
- 实现 assets / liabilities；
- 实现 snapshots；
- 实现 reports；
- 实现 exchange rates；
- 实现 stats overview。

### 阶段 4：数据迁移

- 编写旧库到新库迁移脚本；
- 在数据库副本上试跑；
- 校验行数；
- 校验财务合计；
- 写明手动迁移步骤。

### 阶段 5：Web 客户端切换

- 生成 OpenAPI 类型或建立 V2 typed client；
- Web 改接 V2 API；
- Web 移除旧 sync client；
- Web 类型改为 V2 DTO / generated client；
- Web 主要页面完成 V2 数据流改造；
- Web 完成登录、总览、资产、负债、快照、AI review 的基本验收。

### 阶段 6：最终验收与旧后端清理

- iOS 本地优先能力先保持不动；
- iOS 网络同步等需求明确后，再按 V2 API 设计接入；
- V2 验证完成后，仓库日常开发只保留 TS 后端。

## 15. 实施阶段需要确认的决策

以下问题留到 implementation plan 阶段决定：

- Prisma model 的精确命名；
- 是否沿用旧表名，还是使用新的 V2 表名；
- 密码哈希是否完全保留；
- API 路径最终命名；
- 只用 NestJS class-validator，还是结合 Zod；
- V2 首版是否包含新的 sync API。
- 如果 OpenAPI 生成在首期受阻，是否临时手写 V2 client。

这些不影响当前技术方向。

## 16. 验收标准

迁移完成的标准：

- `apps/backend` 已替换为 TypeScript 后端，并可以本地启动；
- V2 后端可以连接 PostgreSQL；
- V2 auth 可以正常注册、登录、刷新、登出；
- V2 可以提供核心财务数据；
- 现有重要数据已一次性迁移；
- 旧数据库已经备份，备份文件存在且可用于恢复；
- 迁移使用新 V2 数据库完成，不依赖直接破坏旧库；
- 用户、资产、负债、快照、报告、汇率行数校验通过；
- 每个用户迁移前后的总资产、总负债、净资产校验通过；
- Web 已完成 breaking API 改造；
- Web 可以通过 V2 登录并展示迁移后的资产、负债、快照和统计数据；
- Web 不再依赖旧 `/api/v1`、`/sync/changes`、`/sync/push`；
- Java 后端代码不再存在于当前工作树中，必要时通过 Git 历史回看。

硬性验收清单：

```text
[ ] 旧库 pg_dump 备份完成
[ ] 新 V2 数据库创建完成
[ ] Prisma migrations 执行完成
[ ] 用户数一致
[ ] 资产数一致
[ ] 负债数一致
[ ] 快照数一致
[ ] 报告数一致
[ ] 汇率数一致
[ ] 总资产一致
[ ] 总负债一致
[ ] 净资产一致
[ ] Web 登录成功
[ ] Web 首页可见迁移后数据
[ ] Web 资产/负债列表可见迁移后数据
[ ] Web 不再调用旧 API
```

## 17. 总结

Backend V2 应该是一套干净的 TypeScript 后端，而不是 Java 后端的翻译版。

技术栈采用 `NestJS + Prisma + PostgreSQL`，优先保证生态成熟、长期可预期、结构清晰、AI 容易协作。

迁移策略采用一次性离线迁移。旧 API 和旧客户端契约可以抛弃，但现有数据必须保留。

消费流水和 Agent 复盘是未来方向，本期只预留架构空间，不让它们扩大首期迁移范围。
