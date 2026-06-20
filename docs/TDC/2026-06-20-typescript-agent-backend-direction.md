# TypeScript Agent-friendly 后端技术方向

> 日期：2026-06-20
> 状态：技术方向头脑风暴，作为后续迁移 TDC 的前置决策
> 结论：RiceFinance 的长期后端方向倾向于轻量、现代、适合 Agent 实验的 TypeScript API 服务。

---

## 1. 背景

当前项目已经有一套 Java / Spring Boot 后端原型，包含认证、同步、资产实体、统计和 AI review 等模块。

但 RiceFinance 的真实目标不只是做一个稳定的数据 CRUD 服务，而是作为个人长期使用的财务工具，同时承担学习 iOS、TypeScript、前端和 AI Agent 应用开发的目的。

在这个前提下，技术栈需要服务三个目标：

- 对个人长期维护足够轻；
- 对产品快速试验足够灵活；
- 对 AI Agent、结构化输出、工具调用、流水解析和前后端共享类型足够友好。

## 2. 为什么考虑 TypeScript 后端

TypeScript 后端的价值不是“比 Java 更高级”，而是更贴合 RiceFinance 的学习和产品方向。

主要收益：

- 前端、后端、脚本和共享类型可以统一在 TypeScript 生态；
- DTO / Schema 可以在 Web、API、AI 输出之间复用；
- 更适合快速迭代对话、复盘、流水导入解析等 Agent 场景；
- 与 JSON Schema、Zod、tool calling、流式响应等 AI 应用模式更自然；
- 对个人项目来说，工程体量更轻，改动链路更短；
- 对作者本人来说，学习收益和新鲜感更高。

## 3. Java 后端的客观价值

Java / Spring Boot 仍然是严肃后端的成熟选择，尤其适合：

- 大型企业系统；
- 强事务系统；
- 复杂权限和审计；
- 高确定性长期维护；
- 团队协作和成熟工程规范。

当前 Java 后端原型也有价值：

- 已经验证了认证、同步、软删除、冲突处理等核心模型；
- 可以作为未来 TS 重写时的业务参考；
- 数据库 schema 和 API 行为可以被逐步迁移，而不需要一次性全部推翻。

## 4. RiceFinance 的目标技术基调

长期倾向：

```text
iOS / Mac 客户端：SwiftUI + SwiftData
Web 管理端：React + Vite + TypeScript
后端 API：Node.js + TypeScript
数据库：PostgreSQL
Schema / 校验：Zod
ORM / SQL：Drizzle 或 Prisma
AI / Agent 层：TypeScript service，负责复盘、流水解析、工具调用和结构化输出
```

当前更偏好的后端风格：

```text
轻量框架
明确 schema
少魔法
容易写脚本
容易接 AI
容易共享类型
```

候选框架：

- Hono：轻、现代、适合 API / Edge / Agent 实验；
- Fastify：Node 服务端成熟、性能好、插件生态稳；
- NestJS：更接近 Java / Spring 的组织方式，但框架仪式感更强。

初步倾向：优先考虑 Hono 或 Fastify，不急于使用 NestJS。

## 5. 推荐迁移策略

不建议在没有新设计的情况下直接推倒重写。更合适的方式是把 Java 后端视为已实现原型，再做一次 TS 后端的清晰建模。

建议步骤：

1. 梳理当前 Java 后端已有能力：Auth、Sync、Stats、AI、Exchange Rate。
2. 在 `specs/` 中先定义跨端共享 DTO / API 契约。
3. 设计 TS 后端最小骨架：项目结构、数据库迁移、Zod schema、错误格式、鉴权。
4. 先迁移核心资产 / 负债 / 快照同步接口。
5. 再迁移 AI review，并扩展到 Agent 复盘。
6. 最后加入消费流水导入和消费习惯复盘。

## 6. 技术边界

即使采用 TypeScript 后端，也要保持严肃的数据边界：

- 金额使用 decimal 字符串或数据库 decimal，避免浮点误差；
- 所有 API 输入必须有运行时 schema 校验；
- 消费流水属于高隐私数据，后续需要考虑本地优先、脱敏、加密和最小上传；
- AI 不直接读取散乱原始数据，应读取经过汇总和脱敏的结构化上下文；
- AI 输出必须结构化保存，并明确“不构成投资建议”。

## 7. 暂定结论

RiceFinance 不需要用 Java 来证明自己是严肃后端项目。

它更适合采用轻量、现代、TypeScript-first、Agent-friendly 的后端路线。Java 原型保留为已验证的业务参考，后续迁移重点不是机械重写，而是重新设计更适合个人长期迭代和 AI Agent 能力生长的技术底座。
