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

### 1.3 范围（v0.2，阶段 5）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_explain` | 查看查询执行计划（EXPLAIN），只读诊断 | 是 |
| `sql_list_indexes` | 列出表的索引（名称/列/是否唯一） | 是 |
| `sql_database_info` | 数据库版本、当前库、当前用户、服务器时间 | 是 |
| `sql_table_stats` | 各表估算行数（PG reltuples / MySQL information_schema） | 是 |
| `sql_search_columns` | 按列名模糊搜索表和列（ILIKE/LIKE，参数化） | 是 |

**不在范围（v0.2）**：ANALYZE/VACUUM、写操作、跨库查询。

### 1.4 范围（v0.3，阶段 6）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_ping` | 连接测试：SELECT 1 + 延迟毫秒 | 是 |
| `sql_list_views` | 列出视图（PG：pg_views；MySQL：information_schema.views） | 是 |
| `sql_table_size` | 表大小：数据/索引/合计字节（PG：pg_total_relation_size；MySQL：data_length+index_length） | 是 |
| `sql_get_schema` | 查看建表 DDL（MySQL：SHOW CREATE TABLE；PG：由 information_schema 生成简化 CREATE TABLE） | 是 |

**不在范围（v0.3）**：写操作、执行 DDL、跨库查询。

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

### 阶段 5：v0.2 扩展（只读诊断与发现）
- [x] `sql_explain`（复用 query 路径，EXPLAIN 前缀已在白名单）
- [x] Driver 新增 `listIndexes`/`databaseInfo`/`tableStats`/`searchColumns` + PG/MySQL 实现
- [x] 注册 5 个新工具 + UI 呈现
- [x] 验收：mock 单测；typecheck；build
- [x] README 双语更新 + 推送

### 阶段 6：v0.3 扩展（连接与结构）
- [x] `sql_ping`：SELECT 1 + 延迟
- [x] Driver 新增 `listViews`/`tableSize`/`getSchema` + PG/MySQL 实现
- [x] 注册 4 个新工具 + UI 呈现
- [x] 验收：mock 单测；typecheck；build
- [x] README 双语更新 + 推送

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

### 2026-08-14（阶段 5 规划）
- 规划 v0.2：新增 5 个只读工具（explain/索引/库信息/表统计/列搜索），全部保持只读安全模型。
- 复用 `query` 路径实现 explain（EXPLAIN 前缀已白名单，EXPLAIN + 写语句会被黑名单拒绝）。

### 2026-08-14（阶段 5 实现）
- Driver 接口新增 `listIndexes`/`databaseInfo`/`tableStats`/`searchColumns`，PG/MySQL 双驱动实现。
  - PG 索引查询用 `pg_index` + `unnest(ix.indkey)` 拆列名；MySQL 用 `SHOW INDEX` 按 `Key_name` 分组。
  - 表统计均为优化器估算值（PG `reltuples` / MySQL `TABLE_ROWS`），输出标注 estimated。
  - 列搜索 ILIKE/LIKE 参数化，`DbClient` 统一把裸 pattern 包成 `%pattern%`，LIMIT 100。
- 注册 5 个新工具：`sql_explain`/`sql_list_indexes`/`sql_database_info`/`sql_table_stats`/`sql_search_columns`（共 8 工具）。
- `sql_explain` 自动补 `EXPLAIN ` 前缀（已以 explain 开头则不重复），写语句仍被 assertReadOnly 拒绝。
- 测试增至 41/41（client 19 + tools 22）；typecheck / build 全绿。
- 踩坑：mysql2 `conn.query<T>` 泛型要求 `RowDataPacket` 约束，自定义对象数组改 `as` 断言；render 推断属性可选需 `?? []` 兜底。

### 2026-08-14（阶段 6 规划）
- 规划 v0.3：新增 4 个工具（ping/视图/表大小/建表 DDL），全部只读。
- `sql_get_schema` 的 PG 端用 information_schema 生成简化 CREATE TABLE（不执行 DDL，纯展示）。

### 2026-08-14（阶段 6 实现）
- Driver 接口新增 `listViews`/`tableSize`/`getSchema`，PG/MySQL 双驱动实现。
  - PG 视图：`pg_views`；MySQL：`information_schema.views`（含 VIEW_DEFINITION）。
  - PG 表大小：`pg_total_relation_size`/`pg_relation_size`/`pg_indexes_size`；MySQL：`DATA_LENGTH`+`INDEX_LENGTH`。
  - PG 建表 DDL：由 information_schema.columns 生成简化 CREATE TABLE（列/类型+长度/NOT NULL/DEFAULT），标注 simplified；MySQL：`SHOW CREATE TABLE` 原样返回。
- 注册 4 个新工具：`sql_ping`/`sql_list_views`/`sql_table_size`/`sql_get_schema`（共 12 工具）。
- `sql_ping` 在 client 层用 `performance.now()` 计时 + `SELECT 1`，不新增驱动方法。
- 测试增至 54/54（client 24 + tools 30）；typecheck / build 全绿。

## 5. 风险与决策记录

| 时间 | 决策/风险 | 说明 |
|---|---|---|
| 2026-08-14 | 动态 import 数据库驱动 | pg/mysql2 为 peerDependency 或可选依赖，避免强制安装 |
| 2026-08-14 | 只读白名单校验 | 简单可靠：前缀白名单 + 写关键字黑名单 |
| 2026-08-14 | pg/mysql2 暂放 dependencies | GitHub 安装开箱即用；日后发布 npm 前再评估转 optionalDependencies |
| 2026-08-14 | 黑名单可能误伤字符串字面量 | 如 `WHERE action = 'delete'` 会被拒绝——安全优先，宁可误杀 |
| 2026-08-14 | 表统计为估算值 | reltuples / TABLE_ROWS 是优化器近似值，输出标注 estimated |
| 2026-08-14 | PG 建表 DDL 为简化生成 | 不保证与 pg_dump 完全一致（不含约束/权限），明确标注 simplified |
| 2026-08-14 | 风险：npm 发布受 2FA 限制 | 同 dsh-tool-github，先 GitHub 安装方式 |
