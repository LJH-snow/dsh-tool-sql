# dsh-tool-sql

[English](README.md) | 中文

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
| `sql_query` | 执行只读 SQL 查询，以 JSON 返回行数据（超出 `maxRows` 截断） |
| `sql_list_tables` | 列出表（PostgreSQL：public schema；MySQL：当前数据库） |
| `sql_describe_table` | 查看表结构（列名/类型/可空/默认值） |
| `sql_explain` | 查看只读语句的执行计划（自动补 `EXPLAIN` 前缀） |
| `sql_list_indexes` | 列出表的索引（名称/覆盖列/是否唯一） |
| `sql_database_info` | 数据库信息（版本/当前库/当前用户/服务器时间） |
| `sql_table_stats` | 各表估算行数（近似值，从大到小） |
| `sql_search_columns` | 按列名跨表搜索（支持 `%`/`_`，最多 100 条） |

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
