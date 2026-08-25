# dsh-tool-sql

[English](README.md) | 中文

[![CI](https://github.com/LJH-snow/dsh-tool-sql/actions/workflows/ci.yml/badge.svg)](https://github.com/LJH-snow/dsh-tool-sql/actions/workflows/ci.yml)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）提供**只读 SQL 查询**能力的 Cordis 工具插件。Agent 可以通过自然语言查询数据、列出表、查看表结构，支持 PostgreSQL 和 MySQL，默认强制只读、拒绝一切写操作。

基于官方「一切皆插件」架构，通过 `ctx.tools.register(defineTool(...))` 注册模型可见工具，完全遵循官方 [adding-a-tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) 契约。

## 安装

直接从 GitHub 安装（无需发布 npm）：

```sh
npm install github:LJH-snow/dsh-tool-sql
# 或指定分支/标签
npm install github:LJH-snow/dsh-tool-sql#main
```

或从本地目录安装：

```sh
git clone https://github.com/LJH-snow/dsh-tool-sql
cd dsh-tool-sql
npm install && npm run build   # 构建到 lib/
npm install /path/to/dsh-tool-sql
```

> 发布到 npm 后，也可用 `npm install @libai168/dsh-tool-sql` 安装。

需要 `@deepseek-ai/cordis`（^4.0.1）与 `@deepseek-ai/dsh-tools`（^0.1.0-rc.6）作为 peer 依赖，由宿主 dsh 运行时提供。

## 配置

在 dsh 的组合配置（`cordis.yml`）中加载插件：

```yaml
- name: 'dsh-tool-sql'
  config:
    type: 'postgres'        # 或 'mysql'
    host: 'localhost'
    port: 5432              # 可选（postgres 5432，mysql 3306）
    user: 'dbuser'
    password: 'dbpass'
    database: 'appdb'
    maxRows: 100            # 可选，单次查询返回最大行数（默认 100）
    timeoutMs: 15000        # 可选，查询超时毫秒数（默认 15000）
    ssl: false              # 可选，启用 TLS
```

完整示例：[examples/cordis.yml](examples/cordis.yml)。

> 安全：插件默认强制只读。仅允许 `SELECT`/`EXPLAIN`/`SHOW`/`DESCRIBE`/`WITH`/`PRAGMA`/`VALUES` 语句；包含写关键字（INSERT/UPDATE/DELETE/DDL 等）一律拒绝。凭据只从插件配置读取，绝不打印或写入日志。

## 工具

| 工具 | 说明 |
|---|---|
| `sql_query` | 执行只读 SQL 查询，以 JSON 返回行数据（超出 `maxRows` 截断；可选 `limit` 1-1000） |
| `sql_list_tables` | 列出表（PostgreSQL：public schema；MySQL：当前数据库） |
| `sql_describe_table` | 查看表结构（列名/类型/可空/默认值） |
| `sql_explain` | 查看只读语句的执行计划（自动补 `EXPLAIN` 前缀） |
| `sql_list_indexes` | 列出表的索引（名称/覆盖列/是否唯一） |
| `sql_database_info` | 数据库信息（版本/当前库/当前用户/服务器时间） |
| `sql_table_stats` | 各表估算行数（近似值，从大到小） |
| `sql_search_columns` | 按列名跨表搜索（支持 `%`/`_`，最多 100 条） |
| `sql_ping` | 连接测试（`SELECT 1`，返回往返延迟） |
| `sql_list_views` | 列出视图及定义 |
| `sql_list_schemas` | 列出可见 schema（PostgreSQL）或数据库/schema（MySQL） |
| `sql_list_sequences` | 列出序列（PostgreSQL）；MySQL 提示不支持 |
| `sql_list_constraints` | 列出主键、唯一、检查约束 |
| `sql_list_databases` | 列出连接可见的数据库/schema（PostgreSQL 排除模板库） |
| `sql_list_roles` | 列出 PostgreSQL 角色或 MySQL 账号及关键属性 |
| `sql_list_grants` | 列出可见权限（PostgreSQL：public schema 表授权；MySQL：用户权限） |
| `sql_list_materialized_views` | 列出物化视图（PostgreSQL）；MySQL 提示不支持 |
| `sql_list_partitions` | 列出表分区、方式、边界和估算行数 |
| `sql_get_table_row_count` | 对安全校验后的表名执行精确 `COUNT(*)` 行数统计 |
| `sql_table_size` | 表占用空间（数据/索引/合计字节） |
| `sql_get_schema` | 查看建表 DDL（MySQL：服务器原样；PostgreSQL：catalog 生成简化版） |
| `sql_preview` | 预览表前 N 行数据（表名严格校验，LIMIT 1-100，默认 10） |
| `sql_list_functions` | 列出函数/存储过程（名称/参数/语言/返回类型） |
| `sql_list_triggers` | 列出触发器（名称/表/时机/事件/定义） |
| `sql_list_foreign_keys` | 列出外键（表.列 → 引用表.引用列） |
| `sql_schema_dump` | 导出整库结构：所有表 DDL + 视图定义 |
| `sql_list_extensions` | 列出数据库扩展（PostgreSQL）；MySQL 提示不支持 |
| `sql_search_tables` | 按表/视图/物化视图名称搜索（支持 `%`/`_`，最多 100 条） |
| `sql_database_size` | 当前数据库容量（PostgreSQL 为总量；MySQL 为数据+索引） |
| `sql_list_table_sizes` | 列出所有表的磁盘占用，按总量从大到小 |
| `sql_get_table_comments` | 查看表注释与全部列注释 |
| `sql_list_incoming_foreign_keys` | 查看引用指定表的外键，用于子表影响分析 |
| `sql_get_column_stats` | 列质量分析：总数/非空/空值/去重值/去重比例 |
| `sql_get_function_source` | 返回函数/存储过程源码（匹配全部重载或 SHOW CREATE） |
| `sql_list_enum_types` | 列出 PostgreSQL enum 类型及值；MySQL 提示不支持 |
| `sql_get_table_health` | 查看 PostgreSQL 表活动/维护健康；MySQL 提示不支持 |
| `sql_list_active_queries` | 列出连接可见的非空闲查询（包含查询文本） |
| `sql_search_routines` | 按函数/存储过程名称搜索（支持 `%`/`_`，最多 100 条） |
| `sql_search_indexes` | 按表名或索引名搜索索引，返回覆盖列与唯一性 |
| `sql_list_index_usage` | 列出 PostgreSQL 索引使用统计；MySQL 提示不支持 |
| `sql_list_locks` | 列出连接可见的锁（PostgreSQL pg_locks；MySQL performance_schema） |
| `sql_get_table_last_access` | 查看 PostgreSQL 表最近 seq/index scan 时间与次数；MySQL 提示不支持 |
| `sql_search_view_definitions` | 按视图名或定义文本搜索视图并返回定义 |
| `sql_search_routine_definitions` | 按函数/存储过程名称或源码文本搜索并返回完整定义 |
| `sql_search_trigger_definitions` | 按触发器/表/动作文本搜索触发器并返回定义或动作语句 |
| `sql_search_constraint_definitions` | 按名称或定义文本搜索主键/唯一/检查约束定义 |
| `sql_search_table_ddl` | 按表名搜索并返回建表 DDL（PostgreSQL 简化生成；MySQL 服务器原样） |

## 开发

```sh
npm install
npm run typecheck   # 类型检查
npm test            # 单元测试（vitest）
npm run build       # 构建到 lib/
```

开发计划、决策记录见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 发布与生态

1. 发布使用你的 npm scope：`@libai168/dsh-tool-sql`（npm 发布需要启用 **2FA bypass** 的 granular access token，或 trusted publishing）。
2. `npm run build` 后执行 `npm publish --access public`。
3. 为你的 GitHub 仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic，便于生态发现。

## License

[MIT](LICENSE)
