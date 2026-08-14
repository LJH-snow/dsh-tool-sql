import type { Driver, DbConfig, ColumnInfo } from '../client.js'

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
    async close() {
      await conn.end()
    },
  }
}
