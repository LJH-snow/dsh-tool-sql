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
| 状态 | v0.10 完成：42 工具 + 146 测试全绿，开发文档与代码同步 |

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

### 1.9 范围（v0.8，阶段 11）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_search_tables` | 按表/视图/物化视图名称搜索（支持 `%`/`_`，最多 100 条；PG：public schema；MySQL：当前库） | 是 |
| `sql_database_size` | 当前数据库总容量（PG：`pg_database_size`；MySQL：`DATA_LENGTH` + `INDEX_LENGTH`） | 是 |
| `sql_list_table_sizes` | 列出所有表容量，按总大小从大到小（PG：public schema；MySQL：当前库 BASE TABLE） | 是 |
| `sql_get_table_comments` | 查看表注释与全部列注释（PG：`obj_description`/`col_description`；MySQL：information_schema） | 是 |
| `sql_list_incoming_foreign_keys` | 列出引用指定表的外键（子表影响分析，PG/MySQL 双驱动） | 是 |

**不在范围（v0.8）**：写操作、执行 DDL、跨库查询、执行计划分析。

### 1.10 范围（v0.9，阶段 12）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_get_column_stats` | 单列质量分析：总数/非空/空值/去重值/去重比例（PG/MySQL 双驱动） | 是 |
| `sql_get_function_source` | 返回函数/存储过程源码（PG：全部匹配重载；MySQL：information_schema.routines + SHOW CREATE） | 是 |
| `sql_list_enum_types` | 列出 PostgreSQL enum 类型及声明顺序值；MySQL 提示不支持 | 是 |
| `sql_get_table_health` | 查看 PostgreSQL 表活动与维护状态（seq/index scan、live/dead rows、last vacuum/analyze）；MySQL 提示不支持 | 是 |
| `sql_list_active_queries` | 列出连接可见的非空闲查询（PG：pg_stat_activity；MySQL：information_schema.PROCESSLIST） | 是 |

**不在范围（v0.9）**：写操作、终止查询、执行 DDL、跨库查询。

### 1.11 范围（v0.10，阶段 13）
| 工具 | 功能 | 需凭据 |
|---|---|---|
| `sql_search_routines` | 按函数/存储过程名称搜索（PG：public schema；MySQL：当前库 routines） | 是 |
| `sql_search_indexes` | 按表名或索引名搜索索引并返回覆盖列/唯一性（PG/MySQL 双驱动） | 是 |
| `sql_list_index_usage` | 列出 PostgreSQL 索引使用统计（scan/read/fetched）；MySQL 提示不支持 | 是 |
| `sql_list_locks` | 列出连接可见的锁（PG：pg_locks + pg_stat_activity；MySQL：performance_schema.data_locks） | 是 |
| `sql_get_table_last_access` | 查看 PostgreSQL 表最近 seq/index scan 时间与次数；MySQL 提示不支持 | 是 |

**不在范围（v0.10）**：写操作、终止锁/查询、执行 DDL、跨库查询。

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

### 阶段 11：v0.8 扩展（表发现、注释、依赖与容量）
- [x] Driver 新增 `searchTables`/`databaseSize`/`listTableSizes`/`getTableComments`/`listIncomingForeignKeys` + PG/MySQL 实现
- [x] 注册 5 个新工具：`sql_search_tables`/`sql_database_size`/`sql_list_table_sizes`/`sql_get_table_comments`/`sql_list_incoming_foreign_keys` + UI 呈现
- [x] 验收：mock 单测；typecheck；build；README 双语更新 + 推送

### 阶段 12：v0.9 扩展（数据质量、例程源码与数据库活动）
- [x] Driver 新增 `getColumnStats`/`getFunctionSource`/`listEnumTypes`/`getTableHealth`/`listActiveQueries` + PG/MySQL 实现
- [x] 注册 5 个新工具：`sql_get_column_stats`/`sql_get_function_source`/`sql_list_enum_types`/`sql_get_table_health`/`sql_list_active_queries` + UI 呈现
- [x] 验收：mock 单测；typecheck；build；README 双语更新 + 推送

### 阶段 13：v0.10 扩展（例程/索引检索、锁与访问统计）
- [x] Driver 新增 `searchRoutines`/`searchIndexes`/`listIndexUsage`/`listLocks`/`getTableLastAccess` + PG/MySQL 实现
- [x] 注册 5 个新工具：`sql_search_routines`/`sql_search_indexes`/`sql_list_index_usage`/`sql_list_locks`/`sql_get_table_last_access` + UI 呈现
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

### 2026-08-25（阶段 11 规划）
- 规划 v0.8：表发现、表/列注释、入向外键、数据库容量与全表容量，全部保持只读安全模型。
- `sql_database_size` 在 PostgreSQL 只提供总容量（`pg_database_size`），数据/索引明细标注为 `null`；MySQL 可分别汇总 `DATA_LENGTH`/`INDEX_LENGTH`。

### 2026-08-25（阶段 11 实现）
- Driver 接口新增 `searchTables`/`databaseSize`/`listTableSizes`/`getTableComments`/`listIncomingForeignKeys`，PG/MySQL 双驱动实现。
  - PG 表搜索：`pg_class.relkind` 区分 table/view/materialized view；容量：`pg_total_relation_size`/`pg_relation_size`/`pg_indexes_size`；注释：`obj_description`/`col_description`；入向外键：information_schema 三表 JOIN 按被引用表过滤。
  - MySQL 表搜索：`information_schema.tables` 按 LIKE；容量：`DATA_LENGTH` + `INDEX_LENGTH`；注释：`TABLE_COMMENT`/`COLUMN_COMMENT`；入向外键：`REFERENCED_TABLE_NAME` 过滤。
- 注册 5 个新工具：`sql_search_tables`/`sql_database_size`/`sql_list_table_sizes`/`sql_get_table_comments`/`sql_list_incoming_foreign_keys`（共 32 工具）。
- 测试增至 115/115（client 39 + tools 76）；typecheck / build 全绿。

### 2026-08-25（阶段 12 规划）
- 规划 v0.9：数据质量、例程源码、枚举类型、表健康与活动查询诊断，全部保持只读安全模型。
- `sql_list_active_queries` 会返回查询文本，工具描述明确这是诊断用途；插件不提供终止查询能力。

### 2026-08-25（阶段 12 实现）
- Driver 接口新增 `getColumnStats`/`getFunctionSource`/`listEnumTypes`/`getTableHealth`/`listActiveQueries`，PG/MySQL 双驱动实现。
  - PG 列统计：`COUNT` + `COUNT(DISTINCT)` 聚合；函数源码：`pg_get_functiondef`；枚举：`pg_enum` 按 `enumsortorder` 分组；表健康：`pg_stat_user_tables`；活动查询：`pg_stat_activity`。
  - MySQL 列统计：`COUNT` + `COUNT(DISTINCT)` 聚合；函数源码：`information_schema.routines` + `SHOW CREATE FUNCTION/PROCEDURE`；活动查询：`information_schema.PROCESSLIST`；枚举/表健康不支持。
- 注册 5 个新工具：`sql_get_column_stats`/`sql_get_function_source`/`sql_list_enum_types`/`sql_get_table_health`/`sql_list_active_queries`（共 37 工具）。
- 测试增至 130/130（client 42 + tools 88）；typecheck / build 全绿。

### 2026-08-25（阶段 13 规划）
- 规划 v0.10：例程/索引检索、索引使用统计、锁等待与表访问时间诊断，全部保持只读安全模型。
- `sql_list_locks`/`sql_list_active_queries` 都可能返回会话 SQL 文本，文档明确诊断用途，不提供终止能力。

### 2026-08-25（阶段 13 实现）
- Driver 接口新增 `searchRoutines`/`searchIndexes`/`listIndexUsage`/`listLocks`/`getTableLastAccess`，PG/MySQL 双驱动实现。
  - PG 例程检索：`pg_proc` + `pg_get_function_identity_arguments`；索引检索：`pg_index` 聚合覆盖列；索引使用：`pg_stat_user_indexes` 左关联；锁：`pg_locks` + `pg_stat_activity`；表访问：`pg_stat_user_tables`。
  - MySQL 例程检索：`information_schema.routines`；索引检索：`information_schema.statistics`；锁：`performance_schema.data_locks` + `threads`；索引使用/表访问不支持。
- 注册 5 个新工具：`sql_search_routines`/`sql_search_indexes`/`sql_list_index_usage`/`sql_list_locks`/`sql_get_table_last_access`（共 42 工具）。
- 测试增至 146/146（client 46 + tools 100）；typecheck / build 全绿。

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
| 2026-08-25 | PG 数据库容量不拆分 data/index | `pg_database_size` 提供数据库总量；dataBytes/indexBytes 用 `null` 表达不可用，避免伪造明细 |
| 2026-08-25 | MySQL mysql.user 可能无权限 | `sql_list_roles` 失败时退化到 `USER_PRIVILEGES`，宁可返回较少属性也不让工具直接报错 |
| 2026-08-25 | 精确行数可能扫描大表 | `sql_get_table_row_count` 保持精确语义，工具描述明确提示耗时风险 |
| 2026-08-25 | 列统计可能扫描大表 | DISTINCT 聚合可能较慢，工具描述明确提示；保持精确结果，不做抽样近似 |
| 2026-08-25 | 活动查询包含 SQL 文本 | 面向诊断场景保留完整文本，但不在 UI render 中铺满长查询（截断到 200 字符预览） |
| 2026-08-25 | MySQL 锁诊断依赖 performance_schema | `sql_list_locks` 使用 `performance_schema.data_locks`；旧版本或无权限会按查询错误返回，不编造数据 |
| 2026-08-25 | 索引使用/表访问统计仅 PostgreSQL | 两个工具在 MySQL 返回 `supported: false`，避免把 information_schema 近似值当作真实统计 |
| 2026-08-14 | 风险：npm 发布受 2FA 限制 | 同 dsh-tool-github，先 GitHub 安装方式 |
