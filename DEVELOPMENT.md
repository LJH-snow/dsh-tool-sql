# dsh-tool-sql 开发文档

> 本文档是项目的**单一真源**：先写文档，再照文档开发；每次开发推进后同步更新本文档（含时间戳的进度日志）。

## 1. 项目概览

| 项 | 内容 |
|---|---|
| 项目名 | `dsh-tool-sql` |
| 定位 | DeepSeek Harness（dsh）的**数据库只读查询插件**（Cordis 插件） |
| 发布名 | `@libai168/dsh-tool-sql`（未发布 npm，先走 GitHub 安装） |
| 架构 | 一切皆插件：`ctx.tools.register(defineTool(...))` 注册模型可见工具 |
| 官方参考 | 与 `dsh-tool-github` 同模式（已验证的 defineTool 契约） |
| 项目位置 | `deepseek-harness-pro/dsh-tool-sql/`（与 dsh-tool-github 平级） |
| 状态 | v0.1 完成：3 工具 + 23 测试全绿，已推送 GitHub |

### 1.1 目标
- 让 dsh Agent 能对 PostgreSQL / MySQL 执行**只读**查询：查数据、列表、看表结构。
- 安全第一：默认强制只读（拒绝非 SELECT 语句）、行数上限、查询超时、凭据不落盘不打印。

### 1.2 范围（v0.1）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_query` | 执行只读 SQL 查询（SELECT/EXPLAIN/SHOW/DESCRIBE），返回行数据 | 是 |
| `sql_list_tables` | 列出数据库中的表 | 是 |
| `sql_describe_table` | 查看表结构（列名/类型/可空/默认值） | 是 |

**不在范围**：写操作（INSERT/UPDATE/DELETE/DDL）、多库连接、连接池管理界面。

## 2. 技术背景（契约要点，同 dsh-tool-github 已验证）

- `defineTool` 契约：参数自动校验、输出规范 JSON 值、`exec.signal` 透传、`presentCall`/`presentResult` 纯函数。
- 数据库驱动：`pg`（PostgreSQL）、`mysql2`（MySQL）——**动态 import**，配置哪种才装哪种，保持包轻量。
- 只读强制：语句白名单前缀（`select`/`explain`/`show`/`describe`/`with`），含写关键字（insert/update/delete/drop/alter/create/truncate/grant）→ 拒绝。
- 行数上限：`maxRows`（默认 100）；查询超时：`timeoutMs`（默认 15s）。
- 凭据：从插件配置读取，绝不打印/记录。

## 3. 开发计划

### 阶段 0：文档先行（本文档）
- [x] 规划工具面与安全模型
- [x] 编写本开发文档

### 阶段 1：脚手架
- [x] package.json / tsconfig / 最小插件入口
- [x] 验收：typecheck 通过（补装 `@types/pg` 修复 pg 类型缺失）

### 阶段 2：客户端
- [x] `DbClient` 抽象：`query`/`listTables`/`describeTable` + 只读校验 + 行数限制
- [x] PostgreSQL（pg）与 MySQL（mysql2）适配
- [x] 验收：mock 单测（只读校验、行数截断、错误映射）

### 阶段 3：工具注册
- [x] `sql_query`/`sql_list_tables`/`sql_describe_table` + UI 呈现
- [x] 验收：单测通过；typecheck；build

### 阶段 4：文档与推送
- [x] README 中英、examples/cordis.yml、LICENSE
- [x] 推送 GitHub（`LJH-snow/dsh-tool-sql`，PUBLIC + topics）

## 4. 开发日志

### 2026-08-14（阶段 0）
- 规划 dsh-tool-sql：数据库只读查询插件，PostgreSQL/MySQL 双驱动，动态 import。
- 安全模型：只读白名单 + 行数上限 + 超时 + 凭据保护。

### 2026-08-14（阶段 1-3）
- 补装 `@types/pg` 修复 typecheck（pg 不自带类型，mysql2 自带）。
- 实现 `src/index.ts`：注册 `sql_query`/`sql_list_tables`/`sql_describe_table` 三个工具，含 output schema、render 表格、`presentCall`/`presentResult` 纯函数；`SqlPluginConfig` 透传 `DbClient` 配置。
- 补充 `tests/client.spec.ts`（13 例）与 `tests/tools.spec.ts`（10 例），共 23 例全绿。
- 踩坑：`defineTool` 的 output schema 推断要求 object 节点带 `additionalProperties`；render 中推断属性为可选需 `?? []` 兜底（同 dsh-tool-github 写法）。
- 验证：typecheck ✅ / vitest 23/23 ✅ / build ✅。

### 2026-08-14（阶段 4）
- README.md（英文）+ README.zh.md（中文）双语，安装方式为 GitHub 直接安装（未发布 npm）。
- examples/cordis.yml 组合示例、LICENSE（MIT）、.gitignore。
- package.json 补充 repository/homepage 指向新仓库。
- git init + commit + 推送 `LJH-snow/dsh-tool-sql`（PUBLIC），添加 topics：dsh-plugin/deepseek-harness/cordis/sql/database/agent。

## 5. 风险与决策记录

| 时间 | 决策/风险 | 说明 |
|---|---|---|
| 2026-08-14 | 动态 import 数据库驱动 | pg/mysql2 为 peerDependency 或可选依赖，避免强制安装 |
| 2026-08-14 | 只读白名单校验 | 简单可靠：前缀白名单 + 写关键字黑名单 |
| 2026-08-14 | pg/mysql2 暂放 dependencies | GitHub 安装开箱即用；日后发布 npm 前再评估转 optionalDependencies |
| 2026-08-14 | 黑名单可能误伤字符串字面量 | 如 `WHERE action = 'delete'` 会被拒绝——安全优先，宁可误杀 |
| 2026-08-14 | 风险：npm 发布受 2FA 限制 | 同 dsh-tool-github，先 GitHub 安装方式 |
