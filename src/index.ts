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
        render: (_args, value) => {
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
        },
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
  ]
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
