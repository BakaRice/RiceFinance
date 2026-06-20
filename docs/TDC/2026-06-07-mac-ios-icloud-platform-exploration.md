# 2026-06-07 - Mac + iOS + iCloud 文件库技术探索

> 状态：历史探索方案。由于 Apple Personal Development Team 不支持 iCloud capability，本方案不再作为 RiceFinance 正式多端同步主线。正式路线已调整为自建后端同步，见 `2026-06-07-self-hosted-backend-design.md`。本文仍可作为 JSON 备份、文件导出和 Obsidian 式数据可迁移性的参考。

## 1. 结论

RiceFinance 的多端方案应该更接近 Obsidian 的 vault 模式，而不是传统数据库同步模式：

- 用户的数据文件真实存在于 iCloud Drive 的 RiceFinance 文件夹中；
- iPhone、iPad、Mac 都读取同一个 iCloud 文件库；
- 编辑资产、生成快照、导入数据后，结果都写回这个 iCloud 文件库；
- SwiftData 只作为本机缓存、索引和 UI 查询加速层，不是最终可信数据源；
- 不引入账号系统、自建后端，也不优先使用 CloudKit database。

这意味着产品心智从“App 帮我同步数据库”变成“我的财务数据是一组 iCloud 文件，App 负责编辑、计算和展示它们”。

## 2. 推荐技术路线

### 2.1 平台形态

第一阶段采用 SwiftUI + Mac Catalyst：

1. 将现有 iOS 工程通过 Mac Catalyst 扩展为支持 Mac 的 SwiftUI App。
2. 复用 Models、Services、核心 Views。
3. 为 Mac 增加侧边栏、工具栏、文件状态和宽屏详情体验。
4. 数据文件统一放在 iCloud Drive。
5. SwiftData 作为本地 materialized cache，用于快速查询和离线展示。

这样可以用最小工程成本先验证 Mac + iPhone + iPad 共享同一个 iCloud Vault 的闭环。后续如果 Mac 端需要更深的菜单栏、窗口、多文档或 Finder 集成，再评估拆出原生 macOS target。

### 2.2 iCloud 文件库，而不是 CloudKit 数据库

不使用 CloudKit database 作为主同步方案。CloudKit 更像 App 内部数据库同步，用户通常看不到具体数据文件；这不符合本项目想要的 Obsidian 式玩法。

本项目推荐使用 iCloud Drive ubiquitous container：

```text
iCloud Drive/
└── RiceFinance/
    └── Vault/
        ├── manifest.json
        ├── assets/
        ├── liabilities/
        ├── snapshots/
        ├── reports/
        └── attachments/
```

用户可以在 Finder / Files App 中看到这组文件。App 的所有读写都围绕这个目录进行。

## 3. 文件结构设计

### 3.1 Vault 根目录

```text
RiceFinance Vault
├── manifest.json
├── assets/
│   └── asset-{uid}.json
├── liabilities/
│   └── liability-{uid}.json
├── snapshots/
│   └── snapshot-{yyyy-mm}-{uid}.json
├── reports/
│   ├── report-{yyyy-mm}-{uid}.md
│   └── report-{yyyy-mm}-{uid}.json
└── backups/
    └── ricefinance-backup-{timestamp}.json
```

### 3.2 manifest.json

`manifest.json` 保存文件库级别信息：

```json
{
  "schema": "ricefinance.vault",
  "version": 1,
  "createdAt": "2026-06-07T00:00:00Z",
  "updatedAt": "2026-06-07T00:00:00Z",
  "baseCurrency": "CNY",
  "appVersion": "1.0"
}
```

### 3.3 单记录文件

资产、负债、快照使用单记录 JSON 文件，而不是只维护一个巨大 JSON。

原因：

- 更像 Obsidian 的文件库心智；
- 多设备同时编辑时冲突范围更小；
- Finder / Files App 中更容易定位；
- 后续可以支持 Git、手动备份、第三方脚本处理。

示例：

```json
{
  "schema": "ricefinance.asset",
  "version": 1,
  "uid": "A7F4...",
  "name": "招商银行活期",
  "type": "cash",
  "platform": "招商银行",
  "currency": "CNY",
  "amount": "12000.00",
  "risk": "low",
  "liquidity": "high",
  "note": "",
  "createdAt": "2026-06-07T00:00:00Z",
  "updatedAt": "2026-06-07T00:00:00Z",
  "isArchived": false
}
```

金额建议在文件中保存为字符串或最小货币单位整数，避免 JSON 浮点精度问题。

## 4. App 内数据职责

### 4.1 iCloud 文件是主数据源

所有业务动作最终都必须落到 iCloud 文件：

- 新增资产：创建 `assets/asset-{uid}.json`；
- 编辑资产：原子写回对应 JSON；
- 删除资产：优先标记 `isArchived`，必要时再移入 trash/archive；
- 新增快照：创建 `snapshots/snapshot-{yyyy-mm}-{uid}.json`；
- 生成 AI 复盘：保存 `reports/*.md` 和可选结构化 `reports/*.json`；
- 导入：先生成预览，确认后写入 vault 文件。

### 4.2 SwiftData 是本地缓存

SwiftData 的角色应调整为：

- 启动时从 iCloud vault 扫描文件并导入本地；
- UI 查询、排序、统计走 SwiftData；
- 用户编辑后先写 iCloud 文件，再更新本地 SwiftData；
- 监听 iCloud 文件变化，发现其他设备修改后重新导入对应记录。

这样即使本机数据库损坏，也可以通过 iCloud 文件库重建。

## 5. iCloud 文件访问方案

### 5.1 目录定位

使用 `FileManager.url(forUbiquityContainerIdentifier:)` 获取 iCloud container：

```swift
let containerURL = FileManager.default.url(
    forUbiquityContainerIdentifier: nil
)

let vaultURL = containerURL?
    .appendingPathComponent("Documents", isDirectory: true)
    .appendingPathComponent("Vault", isDirectory: true)
```

需要在 Xcode entitlements 中开启 iCloud Documents，并让容器在 iCloud Drive 中可见。

注意：Apple Personal Development Team 不支持 iCloud capability。使用个人免费团队开发时，target 不应引用 iCloud entitlements；App 会退回本机 Documents 下的 `RiceFinance/Vault` 文件库。换成付费 Apple Developer Team 后，再重新启用 `Support/RiceFinance.entitlements`，即可切回真实 iCloud Drive 文件库。

### 5.2 文件写入

写文件时应使用：

- `FileCoordinator` 协调 iCloud 文件读写；
- 原子写入，避免半写入文件；
- 每条记录包含 `uid`、`updatedAt`、`deviceName` 或 `modifiedBy`；
- 写入后更新本地 SwiftData 缓存。

### 5.3 文件监听

监听 iCloud vault 变化：

- `NSMetadataQuery` 观察 ubiquitous container 文件变更；
- App 进入前台时主动扫描一次；
- Mac 端可以更积极地监听，iOS 端以进入前台和手动刷新为主；
- 对变更文件做增量导入。

## 6. 冲突策略

文件同步模式下，可能出现 iCloud conflict file。

建议规则：

- 同一记录多端编辑：比较 `updatedAt`，较新的版本进入主文件；
- 被覆盖的旧版本保存为 conflict 备份；
- 快照文件一般不自动合并，因为它是历史事实；
- 报告文件如果是 Markdown，保留 iCloud 产生的冲突副本，让用户选择；
- 删除操作第一阶段使用 `isArchived`，减少跨设备误删。

## 7. 与现有工程的衔接

当前已有 `RiceFinanceExportPackage` 和 JSON 导入导出能力，可以作为迁移基础，但需要从“单次导入导出”改成“文件库读写服务”。

建议新增：

```text
Services/
├── Vault/
│   ├── ICloudVaultService.swift
│   ├── VaultFileIndex.swift
│   ├── VaultRecordCodec.swift
│   └── VaultSyncService.swift
```

职责：

- `ICloudVaultService`：定位和创建 iCloud vault；
- `VaultRecordCodec`：模型与 JSON 文件互转；
- `VaultFileIndex`：扫描 assets/liabilities/snapshots/reports；
- `VaultSyncService`：把 vault 文件导入 SwiftData，把本地编辑写回 vault。

## 8. Mac 适配策略

当前 `RootTabView` 适合 iPhone。Mac 端建议：

```text
AppRootView
├── iPhone / compact: TabView
├── iPad: TabView 或 NavigationSplitView
└── Mac: NavigationSplitView + toolbar + file status
```

Mac 端重点体验：

- 侧边栏：总览、资产、分析、快照、报告；
- 文件库状态：显示当前 vault 路径和最近同步时间；
- 菜单栏：打开 iCloud 文件夹、重新扫描、导出备份；
- 报告页：Markdown 预览和复制；
- 表格：资产和负债使用更高密度展示。

当前第一阶段实现：

- Xcode target 开启 Mac Catalyst；
- iPhone / iPad 继续使用 `TabView`；
- Mac Catalyst 使用 `NavigationSplitView` 侧边栏；
- Mac、iPhone、iPad 共享同一套 `RiceFinance/Vault` 文件。

## 9. 建议实施顺序

### Phase 1：文件库抽象

- 新增 iCloud vault 定位服务；
- 定义 vault 目录结构；
- 定义资产、负债、快照单文件 JSON 格式；
- 启动时创建 `manifest.json` 和必要目录。

### Phase 2：本地缓存同步

- 启动时扫描 vault 并导入 SwiftData；
- 新增/编辑/删除资产时写回 vault；
- 生成快照时写入 vault；
- App 进入前台时重新扫描 vault。

### Phase 3：多端与冲突验证

- iPhone 编辑资产，Mac 验证文件和 UI 更新；
- Mac 编辑资产，iPhone 验证文件和 UI 更新；
- 两端同时修改同一文件，验证冲突副本处理；
- 断网编辑后恢复网络，验证 iCloud Drive 合并表现。

### Phase 4：Mac 体验增强

- Mac 侧边栏；
- 打开 vault 文件夹；
- Markdown 报告；
- 表格化资产页；
- 更强的导入导出和备份能力。

## 10. MVP 范围建议

下一版最小闭环：

- App 能创建并使用 iCloud Drive `RiceFinance/Vault`；
- 资产、负债、快照真实写入该文件夹；
- SwiftData 可从该文件夹重建；
- iOS 和 Mac 读取同一套文件；
- 保留现有整包 JSON 导出作为手动备份。

这个方向比 CloudKit database 更贴近用户可理解、可掌控、可迁移的个人财务数据产品。
