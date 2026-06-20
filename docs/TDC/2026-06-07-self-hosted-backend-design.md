# 2026-06-07 - RiceFinance 自建后端技术设计

## 1. 背景与结论

由于 Apple Personal Development Team 不支持 iCloud capability，RiceFinance 如果要稳定支持 iPhone、iPad 与 Mac 多端同步，第一阶段不再把 iCloud Drive 作为正式同步方案。

新的推荐路线：

```text
iPhone / iPad / Mac
        ↓
SwiftData 本地缓存
        ↓
HTTPS API
        ↓
自建后端服务
        ↓
PostgreSQL / MySQL
```

客户端继续保留离线可用能力，SwiftData 负责本地查询和 UI 秒开；后端成为跨设备同步的可信数据源。

## 2. 设计目标

### 2.1 产品目标

- 同一账号在 iPhone、iPad、Mac 看到同一份资产数据；
- 任意设备编辑资产、负债、快照后，其他设备可同步更新；
- 支持离线编辑，联网后自动同步；
- 支持 AI 报告、月度快照等长期数据沉淀；
- 为未来 Web 管理端、自动汇率、订阅能力留下空间。

### 2.2 技术目标

- 后端 MVP 足够简单，便于个人独立开发和维护；
- API 稳定，客户端可渐进迁移；
- 数据库结构清晰，可追踪每条记录的变更时间和删除状态；
- 同步协议采用增量同步，避免每次全量拉取；
- 不依赖 Apple iCloud capability。

## 3. 技术栈建议

### 3.1 推荐方案

后端：

- Kotlin + Spring Boot，或 Java + Spring Boot；
- PostgreSQL 优先，MySQL 也可；
- Flyway 管理数据库迁移；
- JWT access token + refresh token；
- Docker Compose 本地开发；
- Nginx / Caddy 做 HTTPS 反向代理。

客户端：

- SwiftUI；
- SwiftData 本地缓存；
- URLSession 调后端 API；
- 后台同步服务 `SyncService`；
- Keychain 保存 token。

### 3.2 为什么优先 Spring Boot

- CRUD、鉴权、数据库迁移、部署资料成熟；
- 与 MySQL/PostgreSQL 配合稳定；
- 适合从 MVP 演进到正式服务；
- 对后续练习全栈能力更有价值。

如果希望更快出原型，也可以使用 Node.js + NestJS 或 Supabase。但从长期维护和学习价值看，Spring Boot 更适合这个项目。

## 4. 后端模块划分

```text
Backend
├── Auth：注册、登录、刷新 token、登出
├── User：用户资料、默认币种、偏好设置
├── Assets：资产账户
├── Liabilities：负债账户
├── Snapshots：净资产快照与快照明细
├── Reports：AI 复盘报告
├── Sync：增量拉取、批量推送、冲突处理
└── Export：JSON 导出、备份下载
```

MVP 阶段可以先把 `Assets`、`Liabilities`、`Snapshots` 都通过 `Sync` API 统一处理，减少端上调用复杂度。

## 5. 数据模型设计

### 5.1 通用字段

核心业务表建议都有这些字段：

```text
id              后端主键 UUID
user_id         所属用户 UUID
client_uid      客户端生成的稳定 UUID
created_at      服务端创建时间
updated_at      服务端更新时间
client_updated_at 客户端最后编辑时间
deleted_at      软删除时间，可为空
version         整数版本号
```

说明：

- `client_uid` 对应当前 SwiftData model 里的 `uid`，用于离线创建后同步；
- `deleted_at` 用软删除，避免多端同步时误恢复或误删；
- `version` 用于后续乐观锁和冲突判断；
- 金额字段建议数据库使用 `decimal(20, 4)`，API 使用字符串，避免浮点精度问题。

### 5.2 users

```sql
create table users (
    id uuid primary key,
    email varchar(255) not null unique,
    password_hash varchar(255) not null,
    display_name varchar(100),
    base_currency varchar(8) not null default 'CNY',
    created_at timestamptz not null,
    updated_at timestamptz not null
);
```

MVP 可以只支持邮箱密码登录。Apple Sign In 可作为后续增强。

### 5.3 asset_accounts

```sql
create table asset_accounts (
    id uuid primary key,
    user_id uuid not null references users(id),
    client_uid varchar(64) not null,
    name varchar(120) not null,
    type varchar(40) not null,
    platform varchar(120) not null default '',
    currency varchar(8) not null,
    amount decimal(20, 4) not null,
    share_count decimal(20, 6),
    risk varchar(20) not null,
    liquidity varchar(20) not null,
    note text not null default '',
    client_updated_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    deleted_at timestamptz,
    version int not null default 1,
    unique(user_id, client_uid)
);
```

### 5.4 liability_accounts

```sql
create table liability_accounts (
    id uuid primary key,
    user_id uuid not null references users(id),
    client_uid varchar(64) not null,
    name varchar(120) not null,
    type varchar(40) not null,
    currency varchar(8) not null,
    amount decimal(20, 4) not null,
    due_date date,
    note text not null default '',
    client_updated_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    deleted_at timestamptz,
    version int not null default 1,
    unique(user_id, client_uid)
);
```

### 5.5 net_worth_snapshots

```sql
create table net_worth_snapshots (
    id uuid primary key,
    user_id uuid not null references users(id),
    client_uid varchar(64) not null,
    snapshot_date timestamptz not null,
    total_assets decimal(20, 4) not null,
    total_liabilities decimal(20, 4) not null,
    net_worth decimal(20, 4) not null,
    currency varchar(8) not null,
    note text not null default '',
    client_updated_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    deleted_at timestamptz,
    version int not null default 1,
    unique(user_id, client_uid)
);
```

### 5.6 snapshot_items

```sql
create table snapshot_items (
    id uuid primary key,
    user_id uuid not null references users(id),
    snapshot_id uuid not null references net_worth_snapshots(id),
    client_uid varchar(64) not null,
    source_name varchar(120) not null,
    amount decimal(20, 4) not null,
    category varchar(80) not null,
    risk varchar(20) not null,
    liquidity varchar(20) not null,
    is_liability boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique(user_id, client_uid)
);
```

### 5.7 reports

```sql
create table reports (
    id uuid primary key,
    user_id uuid not null references users(id),
    client_uid varchar(64) not null,
    title varchar(160) not null,
    report_type varchar(40) not null,
    markdown text not null,
    summary_json jsonb,
    generated_at timestamptz not null,
    client_updated_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    deleted_at timestamptz,
    version int not null default 1,
    unique(user_id, client_uid)
);
```

## 6. API 设计

### 6.1 基础约定

- API 前缀：`/api/v1`
- 请求和响应：JSON
- 时间格式：ISO 8601 UTC
- 金额：字符串，例如 `"12000.00"`
- 鉴权：`Authorization: Bearer {accessToken}`
- 所有接口只返回当前登录用户的数据

### 6.2 Auth API

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
```

登录响应：

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "文韬",
    "baseCurrency": "CNY"
  }
}
```

### 6.3 增量同步 API

推荐第一版使用两个同步接口：

```http
GET  /api/v1/sync/changes?since=2026-06-07T00:00:00Z
POST /api/v1/sync/push
```

`GET /sync/changes` 返回服务端在 `since` 之后变化过的数据：

```json
{
  "serverTime": "2026-06-07T12:00:00Z",
  "assets": [],
  "liabilities": [],
  "snapshots": [],
  "snapshotItems": [],
  "reports": [],
  "deletions": [
    {
      "entity": "asset",
      "clientUid": "A7F4...",
      "deletedAt": "2026-06-07T10:00:00Z"
    }
  ]
}
```

客户端保存 `serverTime` 作为下一次同步的 `since`。

`POST /sync/push` 批量推送本地变更：

```json
{
  "deviceId": "macbook-pro-uuid",
  "changes": {
    "assets": [
      {
        "clientUid": "A7F4...",
        "name": "招商银行活期",
        "type": "cash",
        "platform": "招商银行",
        "currency": "CNY",
        "amount": "12000.00",
        "shareCount": null,
        "risk": "low",
        "liquidity": "high",
        "note": "",
        "clientUpdatedAt": "2026-06-07T11:59:00Z",
        "deletedAt": null,
        "version": 1
      }
    ],
    "liabilities": [],
    "snapshots": [],
    "reports": []
  }
}
```

响应：

```json
{
  "serverTime": "2026-06-07T12:00:02Z",
  "accepted": [
    {
      "entity": "asset",
      "clientUid": "A7F4...",
      "version": 2
    }
  ],
  "conflicts": []
}
```

## 7. 同步策略

### 7.1 客户端同步状态

客户端本地需要新增同步字段：

```text
syncState: synced / pendingUpload / conflict
lastSyncedAt
serverVersion
deletedAt
```

用户编辑流程：

1. 用户在 iPhone 或 Mac 编辑资产；
2. 先写入 SwiftData；
3. 标记 `syncState = pendingUpload`；
4. 后台调用 `POST /sync/push`；
5. 成功后更新 `serverVersion` 和 `syncState = synced`。

### 7.2 拉取流程

1. App 启动或进入前台；
2. 读取本地 `lastSyncCursor`；
3. 调用 `GET /sync/changes?since=lastSyncCursor`；
4. 把服务端变化合并进 SwiftData；
5. 保存新的 `serverTime`。

### 7.3 冲突策略

MVP 推荐简单规则：

- 如果本地记录没有未上传变更，直接接受服务端版本；
- 如果本地和服务端都改过同一条记录，比较 `clientUpdatedAt`；
- 较新的版本成为当前版本；
- 被覆盖版本保存为 conflict copy，后续在 UI 中提示用户；
- 快照和报告不自动合并，保留两份更安全。

第二阶段可以引入逐字段合并。例如金额、备注、风险等级可以分别比较更新时间，但第一版没必要复杂化。

## 8. 客户端改造边界

现有客户端已经有 SwiftData model，可以继续复用，但需要调整职责：

```text
当前：
SwiftData = 主存储

目标：
SwiftData = 本地缓存 + 离线编辑队列
后端数据库 = 多端可信数据源
```

建议新增客户端服务：

```text
Services/
├── API/
│   ├── APIClient.swift
│   ├── AuthService.swift
│   ├── SyncAPI.swift
│   └── DTOs.swift
├── Sync/
│   ├── SyncService.swift
│   ├── SyncStateStore.swift
│   └── ConflictResolver.swift
└── Security/
    └── KeychainTokenStore.swift
```

现有 `Vault` 服务可以保留为本地 JSON 备份能力，但不再作为正式同步主线。

## 9. 安全与隐私

个人财务数据比较敏感，后端需要至少做到：

- 全站 HTTPS；
- 密码使用 Argon2id 或 bcrypt 哈希；
- refresh token 入库保存哈希值，不保存明文；
- access token 短有效期，例如 15 分钟；
- refresh token 较长有效期，例如 30 天；
- API 按 `user_id` 做严格数据隔离；
- 生产数据库开启自动备份；
- 日志不得打印金额、资产名称、token。

后续增强：

- Apple Sign In；
- 设备管理；
- 端到端加密；
- 审计日志；
- 二步验证。

端到端加密会显著增加搜索、分析和 AI 处理复杂度，不建议 MVP 阶段引入。

## 10. 部署建议

### 10.1 本地开发

```text
docker compose
├── backend
├── postgres
└── redis 可选
```

MVP 不强依赖 Redis。只有在 refresh token 黑名单、限流、任务队列变复杂后再引入。

### 10.2 生产部署

个人项目第一阶段可以选择：

- 一台小 VPS；
- Docker Compose 部署后端和 PostgreSQL；
- Caddy 自动申请 HTTPS；
- 每日数据库备份到对象存储。

更正式的部署：

- 后端容器部署到 Fly.io / Render / Railway / 云服务器；
- 数据库使用托管 PostgreSQL；
- 对象存储保存导出备份和报告附件。

## 11. MVP 实施顺序

### Phase 1：后端骨架

- 创建 Spring Boot 项目；
- 接入 PostgreSQL；
- 配置 Flyway；
- 实现 users 表；
- 实现注册、登录、刷新 token。

### Phase 2：核心数据 API

- 实现资产、负债、快照、报告表；
- 实现 `/sync/push`；
- 实现 `/sync/changes`；
- 实现软删除。

### Phase 3：客户端接入

- 新增 APIClient；
- 新增 Keychain token 保存；
- SwiftData model 增加同步字段；
- 资产/负债/快照保存后进入上传队列；
- App 启动和进入前台拉取服务端变更。

### Phase 4：多端验证

- iPhone 新增资产，Mac 拉取可见；
- Mac 修改金额，iPhone 拉取可见；
- 离线编辑后恢复网络；
- 两端同时修改同一资产，验证冲突策略；
- 删除资产后其他端同步消失。

### Phase 5：运营与备份

- 管理数据库备份；
- 支持用户 JSON 导出；
- 支持账号注销和数据删除；
- 增加基础监控和错误日志。

## 12. 需要暂缓的能力

MVP 暂缓：

- 银行自动同步；
- 实时行情；
- 多用户家庭共享账本；
- 复杂权限系统；
- 端到端加密；
- Web 管理端；
- 订阅付费。

这些能力都可以在后端主线稳定后继续扩展。

## 13. 当前结论

RiceFinance 的正式多端架构建议调整为：

```text
SwiftUI iOS / iPadOS / Mac Catalyst
        ↓
SwiftData local cache
        ↓
SyncService
        ↓
Spring Boot API
        ↓
PostgreSQL
```

iCloud Vault 方案保留为“本地 JSON 备份 / 导出 / 可迁移数据格式”的灵感，不再作为主同步方案。
