import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch, ViewInfo, TableSize, SchemaInfo, FunctionInfo, TriggerInfo, ForeignKeyInfo, SchemaDump } from '../client.js'
import { SqlError, assertSafeIdentifier } from '../client.js'

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

  async function createSchema(table: string): Promise<SchemaInfo> {
    const result = await client.query<{
      column_name: string
      data_type: string
      character_maximum_length: number | null
      is_nullable: string
      column_default: string | null
    }>(
      `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    )
    if (result.rows.length === 0) {
      throw new SqlError(`Table "${table}" not found in public schema.`, 'query')
    }
    const lines = result.rows.map(r => {
      let type = r.data_type
      if (r.character_maximum_length) type += `(${r.character_maximum_length})`
      const parts = [`  ${r.column_name} ${type}`]
      if (r.is_nullable === 'NO') parts.push('NOT NULL')
      if (r.column_default !== null) parts.push(`DEFAULT ${r.column_default}`)
      return parts.join(' ')
    })
    const ddl = `CREATE TABLE public.${table} (\n${lines.join(',\n')}\n);`
    return { table, ddl, simplified: true }
  }

  async function createViews(): Promise<ViewInfo[]> {
    const result = await client.query<{ name: string; definition: string | null }>(
      `SELECT viewname AS name, definition FROM pg_views WHERE schemaname = 'public' ORDER BY viewname`,
    )
    return result.rows.map<ViewInfo>(r => ({ name: r.name, definition: r.definition }))
  }

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
    async listViews() {
      return createViews()
    },
    async tableSize(table) {
      const result = await client.query<{ total: string; data: string; index: string }>(
        `SELECT pg_total_relation_size($1) AS total, pg_relation_size($1) AS data, pg_indexes_size($1) AS index`,
        [table],
      )
      const row = result.rows[0]
      return {
        table,
        dataBytes: Number(row?.data ?? 0),
        indexBytes: Number(row?.index ?? 0),
        totalBytes: Number(row?.total ?? 0),
      }
    },
    async getSchema(table) {
      return createSchema(table)
    },
    async previewTable(table, limit) {
      assertSafeIdentifier(table, 'table name')
      const result = await client.query(`SELECT * FROM "${table}" LIMIT $1`, [limit])
      const columns = result.fields?.map(f => f.name) ?? []
      return { columns, rows: result.rows as Array<Record<string, unknown>> }
    },
    async listFunctions() {
      const result = await client.query<{
        name: string
        arguments: string
        language: string
        return_type: string | null
      }>(
        `SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language, pg_get_function_result(p.oid) AS return_type
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_language l ON l.oid = p.prolang
         WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
         ORDER BY p.proname`,
      )
      return result.rows.map<FunctionInfo>(r => ({
        name: r.name,
        arguments: r.arguments,
        language: r.language,
        returnType: r.return_type,
      }))
    },
    async listTriggers() {
      const result = await client.query<{
        name: string
        table: string
        definition: string
      }>(
        `SELECT t.tgname AS name, c.relname AS table, pg_get_triggerdef(t.oid) AS definition
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal
         ORDER BY c.relname, t.tgname`,
      )
      return result.rows.map<TriggerInfo>(r => {
        const match = /CREATE TRIGGER \S+ (BEFORE|AFTER|INSTEAD OF) (INSERT|UPDATE|DELETE|TRUNCATE)/.exec(r.definition)
        return {
          name: r.name,
          table: r.table,
          timing: match?.[1] ?? '',
          event: match?.[2] ?? '',
          definition: r.definition,
        }
      })
    },
    async listForeignKeys() {
      const result = await client.query<{
        name: string
        table: string
        column: string
        referenced_table: string
        referenced_column: string
      }>(
        `SELECT tc.constraint_name AS name, tc.table_name AS table,
                kcu.column_name AS column, ccu.table_name AS referenced_table,
                ccu.column_name AS referenced_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
         ORDER BY tc.table_name, kcu.ordinal_position`,
      )
      return result.rows.map<ForeignKeyInfo>(r => ({
        name: r.name,
        table: r.table,
        column: r.column,
        referencedTable: r.referenced_table,
        referencedColumn: r.referenced_column,
      }))
    },
    async schemaDump() {
      const tablesResult = await client.query<{ table_name: string }>(
        `SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      )
      const tables = []
      for (const row of tablesResult.rows) {
        const schema = await createSchema(row.table_name)
        tables.push({ table: row.table_name, ddl: schema.ddl, simplified: true })
      }
      const views = await createViews()
      return {
        tables,
        views: views.filter((v): v is ViewInfo & { definition: string } => v.definition !== null)
          .map(v => ({ name: v.name, definition: v.definition })),
      } as SchemaDump
    },
    async close() {
      await client.end()
    },
  }
}

