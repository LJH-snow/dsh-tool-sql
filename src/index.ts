import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallView, ToolResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { DbClient, SqlError } from './client.js'

export const name = 'dsh-tool-sql'
export const inject = ['tools']

export interface SqlPluginConfig {
  /** Database type. */
  type: 'postgres' | 'mysql'
  /** Database host. */
  host: string
  /** Database port (defaults: postgres 5432, mysql 3306). */
  port?: number
  /** Database user. */
  user: string
  /** Database password. Never printed or logged. */
  password: string
  /** Database name. */
  database: string
  /** Connection timeout in ms (default 10000). */
  connectTimeoutMs?: number
  /** Query timeout in ms (default 15000). */
  timeoutMs?: number
  /** Max rows returned per query (default 100). */
  maxRows?: number
  /** Enable TLS for the connection (default false). */
  ssl?: boolean
}

export function apply(ctx: Context, config: SqlPluginConfig) {
  const client = new DbClient(config)
  for (const tool of createTools(client)) {
    ctx.tools.register(tool)
  }
}

/** Build the tool definitions for a client. Exported so tests can drive execute/render directly. */
export function createTools(client: DbClient) {
  return [
    defineTool({
      name: 'sql_query',
      description:
        'Run a read-only SQL query against the configured database (PostgreSQL or MySQL). Only SELECT/EXPLAIN/SHOW/DESCRIBE/WITH statements are allowed; write statements are rejected. Returns up to maxRows (default 100) rows.',
      parameters: {
        sql: { type: 'string', required: true, description: 'Read-only SQL statement, e.g. SELECT * FROM users LIMIT 10' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            columns: { type: 'array', items: { type: 'string' }, description: 'Column names in result order' },
            rows: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Result rows as column-name -> value maps' },
            rowCount: { type: 'integer', description: 'Number of rows returned by the database' },
            truncated: { type: 'boolean', description: 'True when more rows exist but the result was cut to maxRows' },
          },
        },
        render: renderQueryResult,
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Query database`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { columns: string[]; rowCount: number; truncated?: boolean }
        return {
          card: 'generic',
          title: `${v.rowCount ?? 0} rows${v.truncated ? ' (truncated)' : ''}`,
          content: [{ type: 'text', text: (v.columns ?? []).join(', ') }],
        }
      },
      async execute(args, exec) {
        try {
          const result = await client.query(args.sql, exec.signal)
          return {
            columns: result.columns,
            rows: result.rows as unknown as Array<Record<string, JsonValue>>,
            rowCount: result.rowCount,
            truncated: result.truncated,
          }
        } catch (error) {
          if (error instanceof SqlError) throw error
          throw error
        }
      },
    }),

    defineTool({
      name: 'sql_explain',
      description:
        'Show the execution plan of a read-only SQL statement. Runs EXPLAIN (or EXPLAIN + the statement). The statement itself is still read-only: EXPLAIN on a write statement is rejected.',
      parameters: {
        sql: { type: 'string', required: true, description: 'Read-only SQL statement to explain, e.g. SELECT * FROM users WHERE id = 1' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            columns: { type: 'array', items: { type: 'string' }, description: 'Column names in result order' },
            rows: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Plan rows' },
            rowCount: { type: 'integer', description: 'Number of plan rows' },
            truncated: { type: 'boolean', description: 'True when the result was cut to maxRows' },
          },
        },
        render: renderQueryResult,
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Explain query`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { columns: string[]; rowCount: number; truncated?: boolean }
        return {
          card: 'generic',
          title: `Plan: ${v.rowCount ?? 0} row(s)${v.truncated ? ' (truncated)' : ''}`,
          content: [{ type: 'text', text: (v.columns ?? []).join(', ') }],
        }
      },
      async execute(args, exec) {
        try {
          const statement = /^\s*explain\b/i.test(args.sql) ? args.sql : `EXPLAIN ${args.sql}`
          const result = await client.query(statement, exec.signal)
          return {
            columns: result.columns,
            rows: result.rows as unknown as Array<Record<string, JsonValue>>,
            rowCount: result.rowCount,
            truncated: result.truncated,
          }
        } catch (error) {
          if (error instanceof SqlError) throw error
          throw error
        }
      },
    }),

    defineTool({
      name: 'sql_list_tables',
      description: 'List tables in the configured database (PostgreSQL: public schema; MySQL: current database).',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tables: { type: 'array', items: { type: 'string' }, description: 'Table names' },
          },
        },
        render: (_args, value) => {
          const tables = value.tables ?? []
          const lines = tables.length > 0 ? tables : ['(no tables)']
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: `List tables`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { tables?: string[] }
        return { card: 'generic', title: `${v.tables?.length ?? 0} tables` }
      },
      async execute(_args, exec) {
        return { tables: await client.listTables(exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_describe_table',
      description: 'Describe a table schema: column names, types, nullability, and default values.',
      parameters: {
        table: { type: 'string', required: true, description: 'Table name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            table: { type: 'string', description: 'Table name' },
            columns: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'Column name' },
                  type: { type: 'string', description: 'Column data type' },
                  nullable: { type: 'boolean', description: 'Whether the column allows NULL' },
                  defaultValue: { oneOf: [{ type: 'string' }, { type: 'null' }], description: 'Default value' },
                },
              },
              description: 'Columns in ordinal position order',
            },
          },
        },
        render: (_args, value) => {
          const columns = value.columns ?? []
          if (columns.length === 0) return [{ type: 'text', text: `Table "${value.table}" has no columns.` }]
          const lines = ['column\ttype\tnullable\tdefault']
          lines.push('---\t---\t---\t---')
          for (const col of columns) {
            lines.push(`${col.name}\t${col.type}\t${col.nullable ? 'YES' : 'NO'}\t${col.defaultValue ?? ''}`)
          }
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Describe table ${args.table}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { table?: string; columns?: Array<{ name: string; type: string }> }
        return { card: 'generic', title: `Table ${v.table ?? ''}`, content: [{ type: 'text', text: `${v.columns?.length ?? 0} columns` }] }
      },
      async execute(args, exec) {
        return { table: args.table, columns: await client.describeTable(args.table, exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_list_indexes',
      description: 'List indexes of a table: index name, covered columns, and whether it is unique.',
      parameters: {
        table: { type: 'string', required: true, description: 'Table name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            table: { type: 'string', description: 'Table name' },
            indexes: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'Index name' },
                  columns: { type: 'array', items: { type: 'string' }, description: 'Columns covered by the index' },
                  unique: { type: 'boolean', description: 'Whether the index is unique' },
                },
              },
              description: 'Indexes of the table',
            },
          },
        },
        render: (_args, value) => {
          const indexes = value.indexes ?? []
          if (indexes.length === 0) return [{ type: 'text', text: `Table "${value.table}" has no indexes.` }]
          const lines = ['index\tcolumns\tunique']
          lines.push('---\t---\t---')
          for (const idx of indexes) {
            lines.push(`${idx.name}\t${(idx.columns ?? []).join(', ')}\t${idx.unique ? 'YES' : 'NO'}`)
          }
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `List indexes of ${args.table}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { table?: string; indexes?: unknown[] }
        return { card: 'generic', title: `Indexes: ${v.table ?? ''}`, content: [{ type: 'text', text: `${v.indexes?.length ?? 0} index(es)` }] }
      },
      async execute(args, exec) {
        return { table: args.table, indexes: await client.listIndexes(args.table, exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_database_info',
      description: 'Show database server info: version, current database, current user, and server time.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            version: { type: 'string', description: 'Database server version' },
            database: { type: 'string', description: 'Current database name' },
            user: { type: 'string', description: 'Current user' },
            serverTime: { type: 'string', description: 'Server time (ISO)' },
          },
        },
        render: (_args, value) => {
          const lines = [
            `version: ${value.version ?? ''}`,
            `database: ${value.database ?? ''}`,
            `user: ${value.user ?? ''}`,
            `server time: ${value.serverTime ?? ''}`,
          ]
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: `Database info`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { database?: string; version?: string }
        return { card: 'generic', title: `Database ${v.database ?? ''}`, content: [{ type: 'text', text: v.version ?? '' }] }
      },
      async execute(_args, exec) {
        return await client.databaseInfo(exec.signal)
      },
    }),

    defineTool({
      name: 'sql_table_stats',
      description: 'List tables with estimated row counts (optimizer estimates, not exact), largest first.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            stats: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  table: { type: 'string', description: 'Table name' },
                  schema: { type: 'string', description: 'Schema name' },
                  estimatedRows: { type: 'integer', description: 'Estimated row count (approximate)' },
                },
              },
              description: 'Per-table estimated row counts',
            },
          },
        },
        render: (_args, value) => {
          const stats = value.stats ?? []
          if (stats.length === 0) return [{ type: 'text', text: '(no tables)' }]
          const lines = ['table\tschema\testimated_rows']
          lines.push('---\t---\t---')
          for (const s of stats) {
            lines.push(`${s.table}\t${s.schema ?? ''}\t${s.estimatedRows ?? 0}`)
          }
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: `Table stats`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { stats?: unknown[] }
        return { card: 'generic', title: `${v.stats?.length ?? 0} table(s)` }
      },
      async execute(_args, exec) {
        return { stats: await client.tableStats(exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_search_columns',
      description:
        'Search tables and columns by column name (case-insensitive, supports % and _ wildcards). Returns up to 100 matches.',
      parameters: {
        pattern: { type: 'string', required: true, description: 'Column name pattern, e.g. "user" or "%created_%"' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  table: { type: 'string', description: 'Table name' },
                  column: { type: 'string', description: 'Column name' },
                  type: { type: 'string', description: 'Column data type' },
                },
              },
              description: 'Matching columns',
            },
          },
        },
        render: (_args, value) => {
          const matches = value.matches ?? []
          if (matches.length === 0) return [{ type: 'text', text: 'No matching columns found.' }]
          const lines = ['table\tcolumn\ttype']
          lines.push('---\t---\t---')
          for (const m of matches) {
            lines.push(`${m.table}.${m.column}\t${m.type ?? ''}`)
          }
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Search columns: ${args.pattern}`, kind: 'search' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { matches?: unknown[] }
        return { card: 'generic', title: `${v.matches?.length ?? 0} column(s)` }
      },
      async execute(args, exec) {
        return { matches: await client.searchColumns(args.pattern, exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_ping',
      description: 'Test the database connection with SELECT 1 and report round-trip latency in milliseconds.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', description: 'Whether the connection succeeded' },
            latencyMs: { type: 'integer', description: 'Round-trip latency in milliseconds' },
          },
        },
        render: (_args, value) => {
          return [{ type: 'text', text: value.ok ? `Connection OK (${value.latencyMs} ms)` : 'Connection failed.' }]
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: `Ping database`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { ok?: boolean; latencyMs?: number }
        return { card: 'generic', title: v.ok ? `OK (${v.latencyMs ?? 0} ms)` : 'Failed' }
      },
      async execute(_args, exec) {
        return await client.ping(exec.signal)
      },
    }),

    defineTool({
      name: 'sql_list_views',
      description: 'List views in the database (PostgreSQL: public schema; MySQL: current database), with definitions.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            views: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', description: 'View name' },
                  definition: { oneOf: [{ type: 'string' }, { type: 'null' }], description: 'View definition SQL' },
                },
              },
              description: 'Views',
            },
          },
        },
        render: (_args, value) => {
          const views = value.views ?? []
          if (views.length === 0) return [{ type: 'text', text: '(no views)' }]
          const lines = views.map(v => v.definition ? `${v.name}: ${v.definition}` : v.name)
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      presentCall(): ToolCallView {
        return { card: 'generic', title: `List views`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { views?: unknown[] }
        return { card: 'generic', title: `${v.views?.length ?? 0} view(s)` }
      },
      async execute(_args, exec) {
        return { views: await client.listViews(exec.signal) }
      },
    }),

    defineTool({
      name: 'sql_table_size',
      description: 'Show a table\'s disk usage: data size, index size, and total in bytes.',
      parameters: {
        table: { type: 'string', required: true, description: 'Table name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            table: { type: 'string', description: 'Table name' },
            dataBytes: { type: 'integer', description: 'Data size in bytes' },
            indexBytes: { type: 'integer', description: 'Index size in bytes' },
            totalBytes: { type: 'integer', description: 'Total size in bytes' },
          },
        },
        render: (_args, value) => {
          const fmt = (n: number) => {
            if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GiB`
            if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(2)} MiB`
            if (n >= 1024) return `${(n / 1024).toFixed(2)} KiB`
            return `${n} B`
          }
          return [{ type: 'text', text: `data: ${fmt(value.dataBytes ?? 0)}\nindex: ${fmt(value.indexBytes ?? 0)}\ntotal: ${fmt(value.totalBytes ?? 0)}` }]
        },
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Size of ${args.table}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { table?: string; totalBytes?: number }
        return { card: 'generic', title: `Size: ${v.table ?? ''}`, content: [{ type: 'text', text: `${v.totalBytes ?? 0} bytes` }] }
      },
      async execute(args, exec) {
        return await client.tableSize(args.table, exec.signal)
      },
    }),

    defineTool({
      name: 'sql_get_schema',
      description:
        'Show the CREATE TABLE DDL for a table. MySQL returns the server\'s own DDL; PostgreSQL returns a simplified DDL generated from catalog metadata (columns, types, NOT NULL, defaults). Read-only: never executes DDL.',
      parameters: {
        table: { type: 'string', required: true, description: 'Table name' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            table: { type: 'string', description: 'Table name' },
            ddl: { type: 'string', description: 'CREATE TABLE statement' },
            simplified: { type: 'boolean', description: 'True when the DDL is a simplified catalog-generated version (PostgreSQL)' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.ddl ?? '' }],
      },
      presentCall(args): ToolCallView {
        return { card: 'generic', title: `Schema of ${args.table}`, kind: 'read' }
      },
      presentResult(_args, result): ToolResultView | undefined {
        const v = result as unknown as { table?: string; simplified?: boolean }
        return { card: 'generic', title: `Schema: ${v.table ?? ''}${v.simplified ? ' (simplified)' : ''}` }
      },
      async execute(args, exec) {
        return await client.getSchema(args.table, exec.signal)
      },
    }),
  ]
}

function renderQueryResult(_args: unknown, value: {
  columns?: string[]
  rows?: Array<Record<string, unknown>>
  rowCount?: number
  truncated?: boolean
}): Array<{ type: 'text'; text: string }> {
  const columns = value.columns ?? []
  const rows = value.rows ?? []
  const lines: string[] = []
  if (columns.length > 0) {
    lines.push(columns.join('\t'))
    lines.push(columns.map(() => '---').join('\t'))
    for (const row of rows) {
      lines.push(columns.map((c: string) => formatCell(row[c])).join('\t'))
    }
  }
  if (value.truncated) {
    lines.push(`(truncated: showing ${rows.length} of ${value.rowCount} rows)`)
  } else {
    lines.push(`(${value.rowCount} rows)`)
  }
  return [{ type: 'text', text: lines.join('\n') }]
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
