import type { Driver, DbConfig, ColumnInfo } from '../client.js'

export async function createPostgresDriver(config: DbConfig): Promise<Driver> {
  const pg = await import('pg')
  const client = new pg.Client({
    host: config.host,
    port: config.port ?? 5432,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionTimeoutMillis: config.connectTimeoutMs ?? 10_000,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  return {
    async query(sql, signal) {
      const result = await client.query(sql)
      const columns = result.fields?.map(f => f.name) ?? []
      return { columns, rows: result.rows as Array<Record<string, unknown>> }
    },
    async listTables() {
      const result = await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      )
      return result.rows.map(r => r.tablename)
    },
    async describeTable(table) {
      const result = await client.query<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table],
      )
      return result.rows.map(r => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
        defaultValue: r.column_default,
      }))
    },
    async close() {
      await client.end()
    },
  }
}
