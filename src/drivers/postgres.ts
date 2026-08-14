import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch } from '../client.js'

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
    async listIndexes(table) {
      const result = await client.query<{
        index_name: string
        is_unique: boolean
        column_name: string
        ord: number
      }>(
        `SELECT i.relname AS index_name, ix.indisunique AS is_unique,
                a.attname AS column_name, k.ord
         FROM pg_index ix
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN LATERAL unnest(ix.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord) ON TRUE
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
         WHERE t.relname = $1 AND t.relkind = 'r'
         ORDER BY i.relname, k.ord`,
        [table],
      )
      const indexes = new Map<string, IndexInfo>()
      for (const row of result.rows) {
        let info = indexes.get(row.index_name)
        if (!info) {
          info = { name: row.index_name, columns: [], unique: row.is_unique }
          indexes.set(row.index_name, info)
        }
        info.columns.push(row.column_name)
      }
      return [...indexes.values()]
    },
    async databaseInfo() {
      const result = await client.query<{
        version: string
        database: string
        user: string
        server_time: string
      }>('SELECT version() AS version, current_database() AS database, current_user AS user, now() AS server_time')
      const row = result.rows[0]
      return {
        version: row?.version ?? '',
        database: row?.database ?? '',
        user: row?.user ?? '',
        serverTime: row?.server_time ?? '',
      }
    },
    async tableStats() {
      const result = await client.query<{
        table_name: string
        schema_name: string
        estimated_rows: string
      }>(
        `SELECT c.relname AS table_name, n.nspname AS schema_name, c.reltuples::bigint AS estimated_rows
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY estimated_rows DESC`,
      )
      return result.rows.map<TableStat>(r => ({
        table: r.table_name,
        schema: r.schema_name,
        estimatedRows: Number(r.estimated_rows ?? 0),
      }))
    },
    async searchColumns(pattern) {
      const result = await client.query<{
        table_name: string
        column_name: string
        data_type: string
      }>(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name ILIKE $1
         ORDER BY table_name, ordinal_position
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<ColumnMatch>(r => ({
        table: r.table_name,
        column: r.column_name,
        type: r.data_type,
      }))
    },
    async close() {
      await client.end()
    },
  }
}
