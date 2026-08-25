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
| 状态 | v0.7 完成：26 工具 + 102 测试全绿，已推送 GitHub |

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

### 1.5 范围（v0.4，阶段 7）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_preview` | 查看表前 N 行数据（表名安全校验 + LIMIT，默认 10，上限 100） | 是 |
| `sql_list_functions` | 列出函数/存储过程（名称/参数/语言/返回类型） | 是 |
| `sql_list_triggers` | 列出触发器（表/时机/事件/定义） | 是 |
| `sql_list_foreign_keys` | 列出外键（表/列/引用表/引用列） | 是 |
| `sql_schema_dump` | 整库结构导出：所有表 DDL + 视图定义 | 是 |

**不在范围（v0.4）**：写操作、执行 DDL、跨库查询。

### 1.6 范围（v0.5，阶段 8）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_query`（增强） | 新增可选 `limit` 参数（1-1000，默认 maxRows），模型可直接控制返回行数 | 是 |
| `sql_list_extensions` | 列出数据库扩展/插件（PG：pg_extension；MySQL：不支持返回空并说明） | 是 |
| CI | GitHub Actions：node 22 上 typecheck + test + build，README 徽章 | - |

**不在范围（v0.5）**：写操作、执行 DDL、跨库查询。

### 1.7 范围（v0.6，阶段 9）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_list_schemas` | 列出可见 schema/数据库（PG：当前库 schema；MySQL：SHOW SCHEMAS/databases） | 是 |
| `sql_list_sequences` | 列出序列（PG：public schema 的序列；MySQL：不支持返回空并说明） | 是 |
| `sql_list_constraints` | 列出 PRIMARY KEY / UNIQUE / CHECK 约束（PG：public schema；MySQL：当前库） | 是 |

**不在范围（v0.6）**：写操作、执行 DDL、跨库查询。

### 1.8 范围（v0.7，阶段 10）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_list_databases` | 列出连接可见的数据库/schema（PG：pg_database 排除模板；MySQL：information_schema.schemata） | 是 |
| `sql_list_roles` | 列出角色/账号及关键属性（PG：pg_roles；MySQL：mysql.user，失败退化 USER_PRIVILEGES） | 是 |
| `sql_list_grants` | 列出可见授权（PG：public schema 表授权；MySQL：用户级 USER_PRIVILEGES） | 是 |
| `sql_list_materialized_views` | 列出物化视图及定义（PG：pg_matviews；MySQL：不支持返回空并说明） | 是 |
| `sql_list_partitions` | 列出分区/方式/边界/估算行数（PG：pg_inherits；MySQL：information_schema.PARTITIONS） | 是 |
| `sql_get_table_row_count` | 表名安全校验后执行精确 `COUNT(*)`（大表可能较慢） | 是 |

**不在范围（v0.7）**：写操作、执行 DDL、跨库查询。

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

### 阶段 7：v0.4 扩展（数据预览与对象发现）
- [x] `sql_preview`：表名安全校验 + LIMIT（driver 生成固定 SQL，不走 assertReadOnly）
- [x] Driver 新增 `previewTable`/`listFunctions`/`listTriggers`/`listForeignKeys`/`schemaDump` + PG/MySQL 实现
- [x] 注册 5 个新工具 + UI 呈现
- [x] 验收：mock 单测；typecheck；build
- [x] README 双语更新 + 推送

### 阶段 8：v0.5 增强（查询控制 + 扩展 + CI）
- [x] `sql_query` 新增 `limit` 参数（1-1000，默认 maxRows），`DbClient.query` 支持行数覆盖
- [x] Driver 新增 `listExtensions`（PG：pg_extension；MySQL：空 + 提示）
- [x] GitHub Actions CI：node 22 上 typecheck + test + build
- [x] README 双语更新（工具表 + 徽章）+ 推送

### 阶段 9：v0.6 扩展（数据库对象发现）
- [x] Driver 新增 `listSchemas`/`listSequences`/`listConstraints` + PG/MySQL 实现
- [x] 注册 3 个新工具：`sql_list_schemas`/`sql_list_sequences`/`sql_list_constraints` + UI 呈现
- [x] 验收：mock 单测；typecheck；build；README 双语更新 + 推送

### 阶段 10：v0.7 扩展（实例级授权与分区发现）
- [x] Driver 新增 `listDatabases`/`listRoles`/`listGrants`/`listMaterializedViews`/`listPartitions`/`getTableRowCount` + PG/MySQL 实现
- [x] 注册 6 个新工具：`sql_list_databases`/`sql_list_roles`/`sql_list_grants`/`sql_list_materialized_views`/`sql_list_partitions`/`sql_get_table_row_count` + UI 呈现
- [x] 验收：mock 单测；typecheck；build；README 双语更新 + 推送

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

### 2026-08-14（阶段 7 规划）
- 规划 v0.4：新增 5 个工具（数据预览/函数/触发器/外键/整库结构导出），全部只读。
- `sql_preview` 不走 assertReadOnly（SQL 由驱动固定生成），改为**表名安全校验**（`^[A-Za-z_][A-Za-z0-9_]*$`）+ 双引号/反引号包裹 + LIMIT 参数化。

### 2026-08-14（阶段 7 实现）
- `client.ts` 新增 `assertSafeIdentifier`（只允许字母/数字/下划线）与 5 个方法（`previewTable`/`listFunctions`/`listTriggers`/`listForeignKeys`/`schemaDump`）。
- Driver 双驱动实现：
  - PG 函数：`pg_proc` + `pg_get_function_identity_arguments`；触发器：`pg_trigger` + `pg_get_triggerdef`（正则解析 BEFORE/AFTER/INSTEAD OF + 事件）；外键：`table_constraints` 三表 JOIN；schemaDump 复用内部 `createSchema`/`createViews`。
  - MySQL 函数：`information_schema.routines`；触发器：`information_schema.triggers`（含时机/事件/语句）；外键：`key_column_usage`（REFERENCED_TABLE_NAME 非空）；schemaDump 复用 `getSchemaFor`（SHOW CREATE TABLE 循环）。
  - preview：PG `SELECT * FROM "t" LIMIT $1`；MySQL `SELECT * FROM \`t\` LIMIT ?`。
- 注册 5 个新工具：`sql_preview`/`sql_list_functions`/`sql_list_triggers`/`sql_list_foreign_keys`/`sql_schema_dump`（共 17 工具）。
- `sql_preview` limit 钳制 1-100（默认 10）。
- 测试增至 69/69（client 28 + tools 41）；typecheck / build 全绿。
- 踩坑：驱动对象方法内 `this` 在闭包中不可靠（MySQL `this.getSchema` 类型推断失败），统一改为内部闭包函数。

### 2026-08-14（阶段 8 规划）
- 规划 v0.5：`sql_query` 加 `limit` 参数（模型控制行数，钳制 1-1000，默认 maxRows）；新增 `sql_list_extensions`；补 GitHub Actions CI。

### 2026-08-14（阶段 8 实现）
- `DbClient.query(sql, signal, maxRowsOverride?)`：覆盖行数与 maxRows 取较小值，截断逻辑复用。
- `DbClient` 增加公开 `databaseType` 属性（供工具判断 PG/MySQL 能力差异）。
- `sql_query` 新增可选 `limit`（1-1000）；`sql_list_extensions`：PG 返回 `pg_extension` 列表（含版本），MySQL 返回 `{ supported: false, extensions: [] }` 并渲染提示。
- 新增 `.github/workflows/ci.yml`：ubuntu + node 22，`npm ci` + typecheck + test + build；README 中英加 CI 徽章。
- 测试增至 76/76（client 30 + tools 46）；typecheck / build 全绿。

### 2026-08-25（阶段 9 规划）
- 规划 v0.6：数据库对象发现三件套（schemas/sequences/constraints），全部保持只读安全模型。
- `sql_list_schemas` 在 MySQL 用 `SHOW SCHEMAS` 返回当前用户可见的数据库/schema。

### 2026-08-25（阶段 9 实现）
- Driver 接口新增 `listSchemas`/`listSequences`/`listConstraints`，PG/MySQL 双驱动实现。
- PG schemas：`pg_namespace` 排除 `pg_%` 与 `information_schema`；sequences：`information_schema.sequences`（type/start/increment）；constraints：`pg_constraint` 聚合列并带 `pg_get_constraintdef`。
- MySQL schemas：`SHOW SCHEMAS`；sequences：无序列对象返回空；constraints：`table_constraints` + `key_column_usage` + `check_constraints`，按约束聚合成列数组。
- 注册 3 个新工具：`sql_list_schemas`/`sql_list_sequences`/`sql_list_constraints`（共 20 工具）。
- 测试增至 85/85（client 32 + tools 53）；typecheck / build 全绿。

### 2026-08-25（阶段 10 规划）
- 规划 v0.7：新增数据库/角色/授权/物化视图/分区/精确行数发现工具，全部保持只读安全模型。
- `sql_get_table_row_count` 使用精确 `COUNT(*)`，文档明确提示大表可能耗时。

### 2026-08-25（阶段 10 实现）
- Driver 接口新增 `listDatabases`/`listRoles`/`listGrants`/`listMaterializedViews`/`listPartitions`/`getTableRowCount`，PG/MySQL 双驱动实现。
  - PG databases：`pg_database` 排除模板库；roles：`pg_roles` 聚合关键属性；grants：`role_table_grants` 限定 public schema；物化视图：`pg_matviews`；分区：`pg_inherits` + `pg_partitioned_table` + `pg_get_expr`。
  - MySQL databases：`information_schema.schemata`；accounts：优先读 `mysql.user`，权限不足退化到 `USER_PRIVILEGES`；grants：`USER_PRIVILEGES` 用户级授权；物化视图：不支持返回空；分区：`information_schema.PARTITIONS`；行数：`COUNT(*)` + 反引号安全拼接。
- 注册 6 个新工具：`sql_list_databases`/`sql_list_roles`/`sql_list_grants`/`sql_list_materialized_views`/`sql_list_partitions`/`sql_get_table_row_count`（共 26 工具）。
- 测试增至 102/102（client 36 + tools 66）；typecheck / build 全绿。

## 5. 风险与决策记录

| 时间 | 决策/风险 | 说明 |
|---|---|---|
| 2026-08-14 | 动态 import 数据库驱动 | pg/mysql2 为 peerDependency 或可选依赖，避免强制安装 |
| 2026-08-14 | 只读白名单校验 | 简单可靠：前缀白名单 + 写关键字黑名单 |
| 2026-08-14 | pg/mysql2 暂放 dependencies | GitHub 安装开箱即用；日后发布 npm 前再评估转 optionalDependencies |
| 2026-08-14 | 黑名单可能误伤字符串字面量 | 如 `WHERE action = 'delete'` 会被拒绝——安全优先，宁可误杀 |
| 2026-08-14 | 表统计为估算值 | reltuples / TABLE_ROWS 是优化器近似值，输出标注 estimated |
| 2026-08-14 | PG 建表 DDL 为简化生成 | 不保证与 pg_dump 完全一致（不含约束/权限），明确标注 simplified |
| 2026-08-14 | preview 表名严格校验 | 只允许字母数字下划线，杜绝表名拼接注入；非法表名直接拒绝 |
| 2026-08-14 | schema_dump 体量可控 | 表 DDL 简化生成 + 视图定义，不含触发器/函数定义（用专门工具查） |
| 2026-08-14 | query limit 钳制 1-1000 | 与 maxRows 取较小值，避免模型请求超大结果集 |
| 2026-08-14 | MySQL 无扩展概念 | `sql_list_extensions` 在 MySQL 返回空列表 + unsupported 说明 |
| 2026-08-25 | MySQL 的 schema 即 database | `sql_list_schemas` 在 MySQL 返回 `SHOW SCHEMAS` 可见库，工具描述明确区分两种语义 |
| 2026-08-25 | MySQL 无序列对象 | `sql_list_sequences` 使用与 extensions 相同的 `{ supported: false }` 模式，避免误导 |
| 2026-08-25 | 约束发现范围 | 只覆盖 PRIMARY KEY/UNIQUE/CHECK；外键已有专工具，避免输出重复噪点 |
| 2026-08-25 | MySQL 无物化视图 | `sql_list_materialized_views` 在 MySQL 返回 `{ supported: false }`，避免误认为有对象 |
| 2026-08-25 | MySQL mysql.user 可能无权限 | `sql_list_roles` 失败时退化到 `USER_PRIVILEGES`，宁可返回较少属性也不让工具直接报错 |
| 2026-08-25 | 精确行数可能扫描大表 | `sql_get_table_row_count` 保持精确语义，工具描述明确提示耗时风险 |
| 2026-08-14 | 风险：npm 发布受 2FA 限制 | 同 dsh-tool-github，先 GitHub 安装方式 |
