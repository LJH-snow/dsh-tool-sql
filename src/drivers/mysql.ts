import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch, ViewInfo, TableSize, SchemaInfo } from '../client.js'

export async function createMysqlDriver(config: DbConfig): Promise<Driver> {
  const mysql = await import('mysql2/promise')
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port ?? 3306,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: config.connectTimeoutMs ?? 10_000,
    ssl: config.ssl ? {} : undefined,
  })

  return {
    async query(sql) {
      const [rows, fields] = await conn.query(sql)
      const columns = (fields as Array<{ name: string }> | undefined)?.map(f => f.name) ?? []
      return { columns, rows: rows as Array<Record<string, unknown>> }
    },
    async listTables() {
      const [rows] = await conn.query('SHOW TABLES')
      const list = rows as Array<Record<string, unknown>>
      const key = Object.keys(list[0] ?? {})[0] ?? 'Tables'
      return list.map(r => String(r[key]))
    },
    async describeTable(table) {
      const [rows] = await conn.query('DESCRIBE `' + table.replace(/`/g, '``') + '`')
      const list = rows as Array<{
        Field: string
        Type: string
        Null: string
        Default: unknown
      }>
      return list.map(r => ({
        name: r.Field,
        type: r.Type,
        nullable: r.Null === 'YES',
        defaultValue: r.Default === null || r.Default === undefined ? null : String(r.Default),
      }))
    },
    async listIndexes(table) {
      const [rows] = await conn.query('SHOW INDEX FROM `' + table.replace(/`/g, '``') + '`')
      const list = rows as Array<{
        Key_name: string
        Column_name: string
        Non_unique: number
        Seq_in_index: number
      }>
      const indexes = new Map<string, IndexInfo>()
      for (const row of list) {
        let info = indexes.get(row.Key_name)
        if (!info) {
          info = { name: row.Key_name, columns: [], unique: row.Non_unique === 0 }
          indexes.set(row.Key_name, info)
        }
        info.columns.push(row.Column_name)
      }
      return [...indexes.values()]
    },
    async databaseInfo() {
      const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS database, CURRENT_USER() AS user, NOW() AS server_time')
      const list = rows as Array<{
        version: string
        database: string | null
        user: string
        server_time: string
      }>
      const row = list[0] ?? {}
      return {
        version: row.version ?? '',
        database: row.database ?? '',
        user: row.user ?? '',
        serverTime: row.server_time ?? '',
      }
    },
    async tableStats() {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS table_name, TABLE_SCHEMA AS schema_name, TABLE_ROWS AS estimated_rows
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY estimated_rows DESC`,
      )
      const list = rows as Array<{
        table_name: string
        schema_name: string
        estimated_rows: number | null
      }>
      return list.map<TableStat>(r => ({
        table: r.table_name,
        schema: r.schema_name,
        estimatedRows: Number(r.estimated_rows ?? 0),
      }))
    },
    async searchColumns(pattern) {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
         FROM information_schema.columns
         WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION
         LIMIT 100`,
        [pattern],
      )
      const list = rows as Array<{
        table_name: string
        column_name: string
        data_type: string
      }>
      return list.map<ColumnMatch>(r => ({
        table: r.table_name,
        column: r.column_name,
        type: r.data_type,
      }))
    },
    async listViews() {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS name, VIEW_DEFINITION AS definition
         FROM information_schema.views
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME`,
      )
      const list = rows as Array<{ name: string; definition: string | null }>
      return list.map<ViewInfo>(r => ({ name: r.name, definition: r.definition }))
    },
    async tableSize(table) {
      const [rows] = await conn.query(
        `SELECT DATA_LENGTH AS data, INDEX_LENGTH AS idx
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      )
      const list = rows as Array<{ data: number | null; idx: number | null }>
      const row = list[0]
      const dataBytes = Number(row?.data ?? 0)
      const indexBytes = Number(row?.idx ?? 0)
      return { table, dataBytes, indexBytes, totalBytes: dataBytes + indexBytes }
    },
    async getSchema(table) {
      const [rows] = await conn.query('SHOW CREATE TABLE `' + table.replace(/`/g, '``') + '`')
      const list = rows as Array<{ [key: string]: string }>
      const row = list[0]
      if (!row) throw new Error(`Table "${table}" not found.`)
      const ddlKey = Object.keys(row).find(k => k.toLowerCase() === 'create table')
      const ddl = ddlKey ? row[ddlKey] : ''
      return { table, ddl, simplified: false }
    },
    async close() {
      await conn.end()
    },
  }
}
