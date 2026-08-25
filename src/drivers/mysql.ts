import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch, ViewInfo, TableSize, SchemaInfo, FunctionInfo, TriggerInfo, ForeignKeyInfo, SchemaDump, ExtensionInfo, SequenceInfo, ConstraintInfo, DatabaseItem, RoleInfo, GrantInfo, MaterializedViewInfo, PartitionInfo, TableRowCount } from '../client.js'
import { assertSafeIdentifier } from '../client.js'

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

  async function getSchemaFor(table: string): Promise<SchemaInfo> {
    const [rows] = await conn.query('SHOW CREATE TABLE `' + table.replace(/`/g, '``') + '`')
    const list = rows as Array<{ [key: string]: string }>
    const row = list[0]
    if (!row) throw new Error(`Table "${table}" not found.`)
    const ddlKey = Object.keys(row).find(k => k.toLowerCase() === 'create table')
    const ddl = ddlKey ? row[ddlKey] : ''
    return { table, ddl, simplified: false }
  }

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
    async listSchemas() {
      const [rows] = await conn.query('SHOW SCHEMAS')
      const list = rows as Array<Record<string, unknown>>
      const key = Object.keys(list[0] ?? {})[0] ?? 'Schema'
      return list.map(r => String(r[key]))
    },
    async listDatabases() {
      const [rows] = await conn.query(
        `SELECT SCHEMA_NAME AS name
         FROM information_schema.schemata
         ORDER BY SCHEMA_NAME`,
      )
      const list = rows as Array<{ name: string }>
      return list.map<DatabaseItem>(r => ({ name: r.name }))
    },
    async listRoles() {
      try {
        const [rows] = await conn.query(
          `SELECT USER AS name, HOST AS host, PLUGIN AS plugin, ACCOUNT_LOCKED AS locked
           FROM mysql.user
           ORDER BY USER, HOST`,
        )
        const list = rows as Array<{ name: string; host: string; plugin: string | null; locked: string }>
        return list.map<RoleInfo>(r => {
          const attributes = [`plugin: ${r.plugin ?? 'unknown'}`]
          if (r.locked === 'Y') attributes.push('locked')
          return {
            name: `${r.name}@${r.host}`,
            roleType: 'account',
            attributes,
            detail: r.locked === 'Y' ? 'account is locked' : 'account is unlocked',
          }
        })
      } catch {
        const [rows] = await conn.query('SELECT DISTINCT GRANTEE AS name FROM information_schema.USER_PRIVILEGES ORDER BY GRANTEE')
        const list = rows as Array<{ name: string }>
        return list.map<RoleInfo>(r => ({
          name: r.name,
          roleType: 'account',
          attributes: ['privilege catalog only'],
          detail: 'mysql.user is not readable',
        }))
      }
    },
    async listGrants() {
      const [rows] = await conn.query(
        `SELECT GRANTEE AS grantee, PRIVILEGE_TYPE AS privilege, IS_GRANTABLE AS grantable
         FROM information_schema.USER_PRIVILEGES
         ORDER BY GRANTEE, PRIVILEGE_TYPE`,
      )
      const list = rows as Array<{ grantee: string; privilege: string; grantable: string }>
      return list.map<GrantInfo>(r => ({
        grantee: r.grantee,
        object: '*.*',
        privilege: r.privilege,
        grantable: r.grantable === 'YES',
      }))
    },
    async listMaterializedViews() {
      return [] as MaterializedViewInfo[]
    },
    async listPartitions() {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS parent, PARTITION_NAME AS partition_name,
                PARTITION_METHOD AS method, PARTITION_EXPRESSION AS bound,
                TABLE_ROWS AS estimated_rows
         FROM information_schema.PARTITIONS
         WHERE TABLE_SCHEMA = DATABASE() AND PARTITION_NAME IS NOT NULL
         ORDER BY TABLE_NAME, PARTITION_ORDINAL_POSITION`,
      )
      const list = rows as Array<{
        parent: string
        partition_name: string
        method: string
        bound: string | null
        estimated_rows: number | null
      }>
      return list.map<PartitionInfo>(r => ({
        parent: r.parent,
        partition: r.partition_name,
        method: r.method,
        bound: r.bound,
        estimatedRows: Number(r.estimated_rows ?? 0),
      }))
    },
    async getTableRowCount(table) {
      assertSafeIdentifier(table, 'table name')
      const [rows] = await conn.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``)
      const list = rows as Array<{ row_count: number | string }>
      return { table, rowCount: Number(list[0]?.row_count ?? 0) } as TableRowCount
    },
    async listSequences() {
      return [] as SequenceInfo[]
    },
    async listConstraints() {
      const [rows] = await conn.query(
        `SELECT tc.CONSTRAINT_NAME AS name,
                tc.TABLE_NAME AS table_name,
                tc.CONSTRAINT_TYPE AS type,
                kcu.COLUMN_NAME AS column_name,
                cc.CHECK_CLAUSE AS check_clause
         FROM information_schema.table_constraints tc
         LEFT JOIN information_schema.key_column_usage kcu
           ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND tc.TABLE_NAME = kcu.TABLE_NAME
          AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         LEFT JOIN information_schema.check_constraints cc
           ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
          AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
         WHERE tc.TABLE_SCHEMA = DATABASE()
           AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
         ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
      )
      const list = rows as Array<{
        name: string
        table_name: string
        type: string
        column_name: string | null
        check_clause: string | null
      }>
      const constraints = new Map<string, ConstraintInfo>()
      for (const row of list) {
        const key = `${row.table_name}.${row.name}`
        let info = constraints.get(key)
        if (!info) {
          info = {
            name: row.name,
            table: row.table_name,
            type: row.type as ConstraintInfo['type'],
            columns: [],
            definition: row.check_clause ?? null,
          }
          constraints.set(key, info)
        }
        if (row.column_name) info.columns.push(row.column_name)
      }
      return [...constraints.values()]
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
    async previewTable(table, limit) {
      assertSafeIdentifier(table, 'table name')
      const [rows, fields] = await conn.query('SELECT * FROM `' + table + '` LIMIT ?', [limit])
      const columns = (fields as Array<{ name: string }> | undefined)?.map(f => f.name) ?? []
      return { columns, rows: rows as Array<Record<string, unknown>> }
    },
    async listFunctions() {
      const [rows] = await conn.query(
        `SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS kind, DATA_TYPE AS return_type
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE()
         ORDER BY ROUTINE_NAME`,
      )
      const list = rows as Array<{ name: string; kind: string; return_type: string | null }>
      return list.map<FunctionInfo>(r => ({
        name: r.name,
        arguments: r.kind,
        language: null,
        returnType: r.return_type,
      }))
    },
    async listTriggers() {
      const [rows] = await conn.query(
        `SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS table_name,
                ACTION_TIMING AS timing, EVENT_MANIPULATION AS event, ACTION_STATEMENT AS statement
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = DATABASE()
         ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`,
      )
      const list = rows as Array<{
        name: string
        table_name: string
        timing: string
        event: string
        statement: string
      }>
      return list.map<TriggerInfo>(r => ({
        name: r.name,
        table: r.table_name,
        timing: r.timing,
        event: r.event,
        definition: r.statement,
      }))
    },
    async listForeignKeys() {
      const [rows] = await conn.query(
        `SELECT CONSTRAINT_NAME AS name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
                REFERENCED_TABLE_NAME AS referenced_table, REFERENCED_COLUMN_NAME AS referenced_column
         FROM information_schema.key_column_usage
         WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      )
      const list = rows as Array<{
        name: string
        table_name: string
        column_name: string
        referenced_table: string
        referenced_column: string
      }>
      return list.map<ForeignKeyInfo>(r => ({
        name: r.name,
        table: r.table_name,
        column: r.column_name,
        referencedTable: r.referenced_table,
        referencedColumn: r.referenced_column,
      }))
    },
    async schemaDump() {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS name FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      )
      const list = rows as Array<{ name: string }>
      const tables = []
      for (const row of list) {
        const schema = await getSchemaFor(row.name)
        tables.push({ table: row.name, ddl: schema.ddl, simplified: false })
      }
      const [viewRows] = await conn.query(
        `SELECT TABLE_NAME AS name, VIEW_DEFINITION AS definition
         FROM information_schema.views WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`,
      )
      const views = (viewRows as Array<{ name: string; definition: string | null }>)
        .filter((v): v is { name: string; definition: string } => v.definition !== null)
        .map(v => ({ name: v.name, definition: v.definition }))
      return { tables, views } as SchemaDump
    },
    async listExtensions() {
      return [] as ExtensionInfo[]
    },
    async close() {
      await conn.end()
    },
  }
}
