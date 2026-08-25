# dsh-tool-sql

[English](README.md) | [中文](README.zh.md)

[![CI](https://github.com/LJH-snow/dsh-tool-sql/actions/workflows/ci.yml/badge.svg)](https://github.com/LJH-snow/dsh-tool-sql/actions/workflows/ci.yml)

A Cordis tool plugin that gives [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) **read-only SQL** capabilities. Agents can query data, list tables, and inspect table schemas on PostgreSQL and MySQL in natural language — with a safety-first model that rejects write statements by default.

Built on the official "everything is a plugin" architecture via `ctx.tools.register(defineTool(...))`, following the official [adding-a-tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md) contract.

## Install

Install directly from GitHub (no npm publish needed):

```sh
npm install github:LJH-snow/dsh-tool-sql
# or a specific branch/tag
npm install github:LJH-snow/dsh-tool-sql#main
```

Or from a local checkout:

```sh
git clone https://github.com/LJH-snow/dsh-tool-sql
cd dsh-tool-sql
npm install && npm run build   # builds to lib/
npm install /path/to/dsh-tool-sql
```

> Once published to npm, it will also be installable as `npm install @libai168/dsh-tool-sql`.

Requires `@deepseek-ai/cordis` (^4.0.1) and `@deepseek-ai/dsh-tools` (^0.1.0-rc.6) as peer dependencies, provided by the host dsh runtime.

## Configuration

Load the plugin in a dsh composition config (`cordis.yml`):

```yaml
- name: 'dsh-tool-sql'
  config:
    type: 'postgres'        # or 'mysql'
    host: 'localhost'
    port: 5432              # optional (postgres 5432, mysql 3306)
    user: 'dbuser'
    password: 'dbpass'
    database: 'appdb'
    maxRows: 100            # optional, max rows per query (default 100)
    timeoutMs: 15000        # optional, query timeout in ms (default 15000)
    ssl: false              # optional, enable TLS
```

Full example: [examples/cordis.yml](examples/cordis.yml).

> Security: the plugin enforces read-only by default. Only `SELECT`/`EXPLAIN`/`SHOW`/`DESCRIBE`/`WITH`/`PRAGMA`/`VALUES` statements are allowed; write keywords (INSERT/UPDATE/DELETE/DDL...) are rejected. Credentials are read from plugin config only and are never printed or logged.

## Tools

| Tool | Description |
|---|---|
| `sql_query` | Run a read-only SQL query, returns rows as JSON (truncated to `maxRows`; optional `limit` 1-1000) |
| `sql_list_tables` | List tables (PostgreSQL: `public` schema; MySQL: current database) |
| `sql_describe_table` | Describe a table's columns (name, type, nullable, default) |
| `sql_explain` | Show the execution plan of a read-only statement (auto-prefixes `EXPLAIN`) |
| `sql_list_indexes` | List a table's indexes (name, covered columns, unique) |
| `sql_database_info` | Database server info (version, current database, user, server time) |
| `sql_table_stats` | Per-table estimated row counts, largest first |
| `sql_search_columns` | Search columns by name across tables (supports `%`/`_`, up to 100) |
| `sql_ping` | Test the connection with `SELECT 1`, report round-trip latency |
| `sql_list_views` | List views with their definitions |
| `sql_list_schemas` | List visible schemas (PostgreSQL) or databases/schemas (MySQL) |
| `sql_list_sequences` | List sequences (PostgreSQL); MySQL reports not supported |
| `sql_list_constraints` | List primary key, unique, and check constraints |
| `sql_list_databases` | List databases/schemas visible to the connection (PostgreSQL excludes templates) |
| `sql_list_roles` | List PostgreSQL roles or MySQL accounts with key attributes |
| `sql_list_grants` | List visible privileges (PostgreSQL: public schema table grants; MySQL: user privileges) |
| `sql_list_materialized_views` | List materialized views (PostgreSQL); MySQL reports not supported |
| `sql_list_partitions` | List table partitions, methods, bounds, and estimated rows |
| `sql_get_table_row_count` | Exact `COUNT(*)` row count for a safely validated table name |
| `sql_table_size` | Table disk usage (data, index, total bytes) |
| `sql_get_schema` | `CREATE TABLE` DDL (MySQL: server DDL; PostgreSQL: simplified from catalog) |
| `sql_preview` | Preview the first rows of a table (validated table name, LIMIT 1-100, default 10) |
| `sql_list_functions` | List functions/procedures (name, arguments, language, return type) |
| `sql_list_triggers` | List triggers (name, table, timing, event, definition) |
| `sql_list_foreign_keys` | List foreign keys (table/column → referenced table/column) |
| `sql_schema_dump` | Export whole-database structure: all table DDLs + view definitions |
| `sql_list_extensions` | List extensions (PostgreSQL); MySQL reports not supported |
| `sql_search_tables` | Search table/view/materialized view names (supports `%`/`_`, up to 100) |
| `sql_database_size` | Current database disk usage (PostgreSQL total; MySQL data + index) |
| `sql_list_table_sizes` | Disk usage for every table, largest first |
| `sql_get_table_comments` | Show the table comment and all column comments |
| `sql_list_incoming_foreign_keys` | Show foreign keys from other tables that reference a target table |
| `sql_get_column_stats` | Column quality stats: total/non-null/null/distinct values and distinct ratio |
| `sql_get_function_source` | Return function/procedure source definitions (all matches/catalog + SHOW CREATE) |
| `sql_list_enum_types` | List PostgreSQL enum types and values; MySQL reports not supported |
| `sql_get_table_health` | PostgreSQL table activity/maintenance health; MySQL reports not supported |
| `sql_list_active_queries` | List non-idle queries visible to the connection (query text included) |
| `sql_search_routines` | Search function/procedure names (supports `%`/`_`, up to 100) |
| `sql_search_indexes` | Search indexes by table/index name, with columns and uniqueness |
| `sql_list_index_usage` | PostgreSQL index usage statistics; MySQL reports not supported |
| `sql_list_locks` | List locks visible to the connection (PostgreSQL pg_locks, MySQL performance_schema) |
| `sql_get_table_last_access` | PostgreSQL last seq/index scan times and counts; MySQL reports not supported |
| `sql_search_view_definitions` | Search views by name or definition text and return their definitions |
| `sql_search_routine_definitions` | Search functions/procedures by name or source text and return full definitions |
| `sql_search_trigger_definitions` | Search triggers by trigger/table/action text and return definitions or action statements |
| `sql_search_constraint_definitions` | Search PK/UNIQUE/CHECK constraint definitions by name or definition text |
| `sql_search_table_ddl` | Search tables by name and return CREATE TABLE DDL (PostgreSQL simplified; MySQL server output) |

## Development

```sh
npm install
npm run typecheck   # type check
npm test            # unit tests (vitest)
npm run build       # build to lib/
```

Development plan and decision records: [DEVELOPMENT.md](DEVELOPMENT.md).

## Publishing & Ecosystem

1. Publishing uses your npm scope: `@libai168/dsh-tool-sql` (npm publishing requires a granular access token with **2FA bypass**, or trusted publishing).
2. After `npm run build`, run `npm publish --access public`.
3. Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your GitHub repository for ecosystem discovery.

## License

[MIT](LICENSE)
