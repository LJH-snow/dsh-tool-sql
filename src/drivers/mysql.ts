import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch, ViewInfo, TableSize, SchemaInfo, FunctionInfo, TriggerInfo, ForeignKeyInfo, SchemaDump, ExtensionInfo, SequenceInfo, ConstraintInfo, DatabaseItem, RoleInfo, GrantInfo, MaterializedViewInfo, PartitionInfo, TableRowCount, TableMatch, DatabaseSize, TableSizeItem, TableCommentInfo, ColumnStats, FunctionSourceInfo, EnumTypeInfo, TableHealth, ActiveQueryInfo, RoutineMatchInfo, IndexMatchInfo, IndexUsageInfo, LockInfo, TableAccessInfo, ViewDefinitionMatchInfo, RoutineDefinitionMatchInfo, TriggerDefinitionMatchInfo, ConstraintDefinitionMatchInfo, TableDefinitionMatchInfo, DependencyReference, TableDependenciesInfo, ViewDependenciesInfo, RoutineDependenciesInfo, RoutineReferencesInfo, RoutineReferenceInfo, TriggerDependenciesInfo } from '../client.js'
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

  async function getRoutineCreate(name: string, kind: 'FUNCTION' | 'PROCEDURE'): Promise<string> {
    const quoted = name.replace(/`/g, '``')
    const [sourceRows] = await conn.query(
      kind === 'PROCEDURE' ? `SHOW CREATE PROCEDURE \`${quoted}\`` : `SHOW CREATE FUNCTION \`${quoted}\``,
    )
    const sourceList = sourceRows as Array<Record<string, unknown>>
    const row = sourceList[0] ?? {}
    const key = Object.keys(row).find(k => /^create (function|procedure)$/i.test(k))
    return key ? String(row[key] ?? '') : ''
  }

  async function queryOrNull<T>(sql: string, params?: unknown[]): Promise<T[] | null> {
    try {
      const [rows] = await conn.query(sql, params)
      return rows as T[]
    } catch {
      return null
    }
  }

  function sourceSnippet(source: string, needle: string): string | null {
    const index = source.toLowerCase().indexOf(needle.toLowerCase())
    if (index < 0) return null
    return source.slice(Math.max(0, index - 40), index + needle.length + 80).replace(/\s+/g, ' ').trim()
  }

  function addDependency(dependencies: DependencyReference[], item: DependencyReference): void {
    if (!dependencies.some(d => d.kind === item.kind && d.name === item.name && d.detail === item.detail)) {
      dependencies.push(item)
    }
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
    async searchTables(pattern) {
      const [rows] = await conn.query(
        `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name,
                IF(TABLE_TYPE = 'BASE TABLE', 'table', 'view') AS kind
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE ?
         ORDER BY kind, TABLE_NAME
         LIMIT 100`,
        [pattern],
      )
      const list = rows as Array<{ schema_name: string; table_name: string; kind: string }>
      return list.map<TableMatch>(r => ({
        schema: r.schema_name,
        name: r.table_name,
        kind: r.kind as TableMatch['kind'],
      }))
    },
    async databaseSize() {
      const [rows] = await conn.query(
        `SELECT DATABASE() AS database_name,
                IFNULL(SUM(DATA_LENGTH), 0) AS data,
                IFNULL(SUM(INDEX_LENGTH), 0) AS idx
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE()`,
      )
      const list = rows as Array<{ database_name: string | null; data: number | null; idx: number | null }>
      const row = list[0]
      const dataBytes = Number(row?.data ?? 0)
      const indexBytes = Number(row?.idx ?? 0)
      return {
        database: row?.database_name ?? '',
        totalBytes: dataBytes + indexBytes,
        dataBytes,
        indexBytes,
      } as DatabaseSize
    },
    async listTableSizes() {
      const [rows] = await conn.query(
        `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name,
                DATA_LENGTH AS data, INDEX_LENGTH AS idx
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`,
      )
      const list = rows as Array<{
        schema_name: string
        table_name: string
        data: number | null
        idx: number | null
      }>
      return list.map<TableSizeItem>(r => {
        const dataBytes = Number(r.data ?? 0)
        const indexBytes = Number(r.idx ?? 0)
        return {
          schema: r.schema_name,
          table: r.table_name,
          dataBytes,
          indexBytes,
          totalBytes: dataBytes + indexBytes,
        }
      })
    },
    async getTableComments(table) {
      const [tableRows] = await conn.query(
        'SELECT TABLE_COMMENT AS comment FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table],
      )
      const [columnRows] = await conn.query(
        `SELECT COLUMN_NAME AS name, COLUMN_COMMENT AS comment
         FROM information_schema.columns
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [table],
      )
      const tables = tableRows as Array<{ comment: string | null }>
      const columns = columnRows as Array<{ name: string; comment: string | null }>
      if (columns.length === 0) throw new Error(`Table "${table}" not found.`)
      const rawTableComment = tables[0]?.comment
      return {
        table,
        tableComment: rawTableComment ? String(rawTableComment) : null,
        columns: columns.map(r => ({ name: r.name, comment: r.comment ? String(r.comment) : null })),
      } as TableCommentInfo
    },
    async listIncomingForeignKeys(table) {
      const [rows] = await conn.query(
        `SELECT CONSTRAINT_NAME AS name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
                REFERENCED_TABLE_NAME AS referenced_table, REFERENCED_COLUMN_NAME AS referenced_column
         FROM information_schema.key_column_usage
         WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME = ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [table],
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
    async getColumnStats(table, column) {
      assertSafeIdentifier(table, 'table name')
      assertSafeIdentifier(column, 'column name')
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS row_count,
                COUNT(\`${column}\`) AS non_null,
                COUNT(*) - COUNT(\`${column}\`) AS null_count,
                COUNT(DISTINCT \`${column}\`) AS distinct_count
         FROM \`${table}\``,
      )
      const list = rows as Array<{
        row_count: number | string
        non_null: number | string | null
        null_count: number | string | null
        distinct_count: number | string | null
      }>
      const row = list[0] ?? {}
      const nonNullCount = Number(row.non_null ?? 0)
      const distinctCount = Number(row.distinct_count ?? 0)
      return {
        table,
        column,
        rowCount: Number(row.row_count ?? 0),
        nonNullCount,
        nullCount: Number(row.null_count ?? 0),
        distinctCount,
        distinctRatio: nonNullCount > 0 ? distinctCount / nonNullCount : null,
      } as ColumnStats
    },
    async getFunctionSource(name) {
      const [routineRows] = await conn.query(
        `SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS kind, EXTERNAL_LANGUAGE AS language
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = ?
         ORDER BY ROUTINE_NAME, ROUTINE_TYPE`,
        [name],
      )
      const routines = routineRows as Array<{
        name: string
        kind: 'FUNCTION' | 'PROCEDURE'
        language: string | null
      }>
      if (routines.length === 0) throw new Error(`Function "${name}" not found.`)
      const result: FunctionSourceInfo[] = []
      for (const routine of routines) {
        result.push({
          name: routine.name,
          kind: routine.kind.toLowerCase() as FunctionSourceInfo['kind'],
          arguments: '',
          language: routine.language ?? null,
          source: await getRoutineCreate(routine.name, routine.kind),
        })
      }
      return result
    },
    async listEnumTypes() {
      return [] as EnumTypeInfo[]
    },
    async getTableHealth(table) {
      return {
        table,
        supported: false,
        seqScans: null,
        indexScans: null,
        liveRows: null,
        deadRows: null,
        lastVacuum: null,
        lastAnalyze: null,
      } as TableHealth
    },
    async listActiveQueries() {
      const [rows] = await conn.query(
        `SELECT ID AS id, USER AS user, DB AS database, STATE AS state,
                TIME AS duration_seconds, IFNULL(INFO, '') AS query
         FROM information_schema.PROCESSLIST
         WHERE COMMAND <> 'Sleep' AND INFO IS NOT NULL AND INFO <> ''
         ORDER BY TIME DESC`,
      )
      const list = rows as Array<{
        id: number | string
        user: string
        database: string | null
        state: string | null
        duration_seconds: number | string | null
        query: string
      }>
      return list.map<ActiveQueryInfo>(r => ({
        id: String(r.id),
        user: r.user,
        database: r.database,
        state: r.state,
        durationSeconds: r.duration_seconds === null || r.duration_seconds === undefined ? null : Number(r.duration_seconds),
        query: r.query,
      }))
    },
    async searchRoutines(pattern) {
      const [rows] = await conn.query(
        `SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS kind, EXTERNAL_LANGUAGE AS language
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME LIKE ?
         ORDER BY ROUTINE_NAME, ROUTINE_TYPE
         LIMIT 100`,
        [pattern],
      )
      const list = rows as Array<{
        name: string
        kind: 'FUNCTION' | 'PROCEDURE'
        language: string | null
      }>
      return list.map<RoutineMatchInfo>(r => ({
        name: r.name,
        kind: r.kind.toLowerCase() as RoutineMatchInfo['kind'],
        arguments: '',
        language: r.language ?? null,
      }))
    },
    async searchIndexes(pattern) {
      const [rows] = await conn.query(
        `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name,
                INDEX_NAME AS index_name, COLUMN_NAME AS column_name,
                NON_UNIQUE AS non_unique
         FROM information_schema.statistics
         WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME LIKE ? OR INDEX_NAME LIKE ?)
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
         LIMIT 100`,
        [pattern, pattern],
      )
      const list = rows as Array<{
        schema_name: string
        table_name: string
        index_name: string
        column_name: string | null
        non_unique: number
      }>
      const indexes = new Map<string, IndexMatchInfo>()
      for (const row of list) {
        const key = `${row.schema_name}.${row.table_name}.${row.index_name}`
        let info = indexes.get(key)
        if (!info) {
          info = {
            schema: row.schema_name,
            table: row.table_name,
            name: row.index_name,
            columns: [],
            unique: row.non_unique === 0,
          }
          indexes.set(key, info)
        }
        if (row.column_name) info.columns.push(row.column_name)
      }
      return [...indexes.values()]
    },
    async listIndexUsage() {
      return [] as IndexUsageInfo[]
    },
    async listLocks() {
      const [rows] = await conn.query(
        `SELECT t.PROCESSLIST_ID AS pid, t.PROCESSLIST_USER AS user,
                t.PROCESSLIST_DB AS database, t.PROCESSLIST_STATE AS state,
                d.OBJECT_SCHEMA AS object_schema, d.OBJECT_NAME AS object_name,
                d.LOCK_TYPE AS lock_type, d.LOCK_MODE AS lock_mode,
                d.LOCK_STATUS AS lock_status, t.PROCESSLIST_INFO AS query
         FROM performance_schema.data_locks d
         LEFT JOIN performance_schema.threads t ON t.THREAD_ID = d.THREAD_ID
         ORDER BY d.ENGINE_TRANSACTION_ID, d.LOCK_STATUS
         LIMIT 200`,
      )
      const list = rows as Array<{
        pid: number | string | null
        user: string | null
        database: string | null
        state: string | null
        object_schema: string | null
        object_name: string | null
        lock_type: string
        lock_mode: string
        lock_status: 'GRANTED' | 'WAITING' | string
        query: string | null
      }>
      return list.map<LockInfo>(r => ({
        pid: r.pid === null || r.pid === undefined ? '' : String(r.pid),
        user: r.user,
        database: r.database,
        state: r.state,
        object: r.object_schema && r.object_name ? `${r.object_schema}.${r.object_name}` : null,
        lockType: r.lock_type,
        mode: r.lock_mode,
        granted: r.lock_status === 'GRANTED',
        query: r.query,
      }))
    },
    async getTableLastAccess(table) {
      return {
        table,
        supported: false,
        lastSeqScan: null,
        lastIdxScan: null,
        seqScans: null,
        indexScans: null,
      } as TableAccessInfo
    },
    async searchViewDefinitions(pattern) {
      const [rows] = await conn.query(
        `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS name, VIEW_DEFINITION AS definition
         FROM information_schema.views
         WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME LIKE ? OR VIEW_DEFINITION LIKE ?)
         ORDER BY TABLE_NAME
         LIMIT 100`,
        [pattern, pattern],
      )
      const list = rows as Array<{ schema_name: string; name: string; definition: string | null }>
      return list.map<ViewDefinitionMatchInfo>(r => ({
        schema: r.schema_name,
        name: r.name,
        definition: r.definition,
      }))
    },
    async searchRoutineDefinitions(pattern) {
      const [rows] = await conn.query(
        `SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS name, ROUTINE_TYPE AS kind,
                EXTERNAL_LANGUAGE AS language, ROUTINE_DEFINITION AS definition
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE() AND (ROUTINE_NAME LIKE ? OR ROUTINE_DEFINITION LIKE ?)
         ORDER BY ROUTINE_NAME, ROUTINE_TYPE
         LIMIT 100`,
        [pattern, pattern],
      )
      const list = rows as Array<{
        schema_name: string
        name: string
        kind: 'FUNCTION' | 'PROCEDURE'
        language: string | null
      }>
      const results: RoutineDefinitionMatchInfo[] = []
      for (const routine of list) {
        results.push({
          schema: routine.schema_name,
          name: routine.name,
          kind: routine.kind.toLowerCase() as RoutineDefinitionMatchInfo['kind'],
          arguments: '',
          language: routine.language ?? null,
          source: await getRoutineCreate(routine.name, routine.kind),
        })
      }
      return results
    },
    async searchTriggerDefinitions(pattern) {
      const [rows] = await conn.query(
        `SELECT TRIGGER_SCHEMA AS schema_name, EVENT_OBJECT_TABLE AS table_name,
                TRIGGER_NAME AS name, ACTION_TIMING AS timing,
                EVENT_MANIPULATION AS event, ACTION_STATEMENT AS definition
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = DATABASE()
           AND (TRIGGER_NAME LIKE ? OR EVENT_OBJECT_TABLE LIKE ? OR ACTION_STATEMENT LIKE ?)
         ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME
         LIMIT 100`,
        [pattern, pattern, pattern],
      )
      const list = rows as Array<{
        schema_name: string
        table_name: string
        name: string
        timing: string
        event: string
        definition: string
      }>
      return list.map<TriggerDefinitionMatchInfo>(r => ({
        schema: r.schema_name,
        table: r.table_name,
        name: r.name,
        timing: r.timing,
        event: r.event,
        definition: r.definition ?? null,
      }))
    },
    async searchConstraintDefinitions(pattern) {
      const [rows] = await conn.query(
        `SELECT tc.CONSTRAINT_SCHEMA AS schema_name, tc.TABLE_NAME AS table_name,
                tc.CONSTRAINT_NAME AS name, tc.CONSTRAINT_TYPE AS type,
                kcu.COLUMN_NAME AS column_name, cc.CHECK_CLAUSE AS check_clause
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
           AND (tc.CONSTRAINT_NAME LIKE ? OR COALESCE(cc.CHECK_CLAUSE, '') LIKE ?)
         ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
         LIMIT 100`,
        [pattern, pattern],
      )
      const list = rows as Array<{
        schema_name: string
        table_name: string
        name: string
        type: string
        column_name: string | null
        check_clause: string | null
      }>
      const constraints = new Map<string, {
        schema: string
        table: string
        name: string
        type: ConstraintDefinitionMatchInfo['type']
        columns: string[]
      }>()
      const checkClauses = new Map<string, string | null>()
      for (const row of list) {
        const key = `${row.schema_name}.${row.table_name}.${row.name}`
        let info = constraints.get(key)
        if (!info) {
          info = {
            schema: row.schema_name,
            table: row.table_name,
            name: row.name,
            type: row.type as ConstraintDefinitionMatchInfo['type'],
            columns: [],
          }
          constraints.set(key, info)
        }
        checkClauses.set(key, row.check_clause)
        if (row.column_name) info.columns.push(row.column_name)
      }
      return [...constraints.values()].map<ConstraintDefinitionMatchInfo>(info => {
        const checkClause = checkClauses.get(`${info.schema}.${info.table}.${info.name}`)
        const definition = checkClause ?? `${info.type} (${info.columns.join(', ')})`
        return {
          ...info,
          definition: definition || null,
          simplified: checkClause === null || checkClause === undefined,
        }
      })
    },
    async searchTableDefinitions(pattern) {
      const [rows] = await conn.query(
        `SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE ?
         ORDER BY TABLE_NAME
         LIMIT 100`,
        [pattern],
      )
      const list = rows as Array<{ schema_name: string; table_name: string }>
      const matches: TableDefinitionMatchInfo[] = []
      for (const row of list) {
        const schema = await getSchemaFor(row.table_name)
        matches.push({ schema: row.schema_name, table: row.table_name, definition: schema.ddl, simplified: false })
      }
      return matches
    },
    async getTableDependencies(table) {
      const dependencies: DependencyReference[] = []
      const views = await queryOrNull<{ view_name: string }>(
        `SELECT DISTINCT VIEW_NAME AS view_name
         FROM information_schema.VIEW_TABLE_USAGE
         WHERE VIEW_SCHEMA = DATABASE() AND TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY VIEW_NAME`,
        [table],
      )
      if (views) {
        for (const row of views) {
          addDependency(dependencies, { kind: 'view', name: row.view_name, detail: null, source: 'catalog' })
        }
      } else {
        const [rows] = await conn.query(
          `SELECT TABLE_NAME AS name
           FROM information_schema.views
           WHERE TABLE_SCHEMA = DATABASE() AND VIEW_DEFINITION LIKE ?
           ORDER BY TABLE_NAME`,
          [`%${table}%`],
        )
        const list = rows as Array<{ name: string }>
        for (const row of list) {
          addDependency(dependencies, { kind: 'view', name: row.name, detail: null, source: 'definition text' })
        }
      }
      const routines = await queryOrNull<{ routine_name: string }>(
        `SELECT DISTINCT ROUTINE_NAME AS routine_name
         FROM information_schema.ROUTINE_TABLE_USAGE
         WHERE ROUTINE_SCHEMA = DATABASE() AND TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ROUTINE_NAME`,
        [table],
      )
      if (routines) {
        for (const row of routines) {
          addDependency(dependencies, { kind: 'routine', name: row.routine_name, detail: null, source: 'catalog' })
        }
      } else {
        const [rows] = await conn.query(
          `SELECT ROUTINE_NAME AS name
           FROM information_schema.routines
           WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_DEFINITION LIKE ?
           ORDER BY ROUTINE_NAME`,
          [`%${table}%`],
        )
        const list = rows as Array<{ name: string }>
        for (const row of list) {
          addDependency(dependencies, { kind: 'routine', name: row.name, detail: null, source: 'definition text' })
        }
      }
      const [triggerRows] = await conn.query(
        `SELECT TRIGGER_NAME AS name
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?
         ORDER BY TRIGGER_NAME`,
        [table],
      )
      for (const row of triggerRows as Array<{ name: string }>) {
        addDependency(dependencies, { kind: 'trigger', name: row.name, detail: null, source: 'catalog' })
      }
      const [fkRows] = await conn.query(
        `SELECT CONSTRAINT_NAME AS name, TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
                REFERENCED_TABLE_NAME AS referenced_table, REFERENCED_COLUMN_NAME AS referenced_column
         FROM information_schema.key_column_usage
         WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME = ?
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [table],
      )
      for (const row of fkRows as Array<{
        name: string
        table_name: string
        column_name: string
        referenced_table: string
        referenced_column: string
      }>) {
        addDependency(dependencies, {
          kind: 'foreign key',
          name: row.name,
          detail: `${row.table_name}.${row.column_name} -> ${row.referenced_table}.${row.referenced_column}`,
          source: 'catalog',
        })
      }
      return { table, dependencies } as TableDependenciesInfo
    },
    async getViewDependencies(view) {
      const dependencies: DependencyReference[] = []
      let definition: string | null = null
      const usage = await queryOrNull<{ name: string; kind: string }>(
        `SELECT v.TABLE_NAME AS name,
                IF(t.TABLE_TYPE = 'VIEW', 'view', 'table') AS kind
         FROM information_schema.VIEW_TABLE_USAGE v
         LEFT JOIN information_schema.tables t
           ON t.TABLE_SCHEMA = v.TABLE_SCHEMA AND t.TABLE_NAME = v.TABLE_NAME
         WHERE v.VIEW_SCHEMA = DATABASE() AND v.VIEW_NAME = ? AND v.TABLE_SCHEMA = DATABASE()
         ORDER BY v.TABLE_NAME`,
        [view],
      )
      if (usage) {
        for (const row of usage) {
          addDependency(dependencies, {
            kind: row.kind as DependencyReference['kind'],
            name: row.name,
            detail: null,
            source: 'catalog',
          })
        }
      } else {
        const [viewRows] = await conn.query(
          `SELECT VIEW_DEFINITION AS definition
           FROM information_schema.views
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [view],
        )
        definition = (viewRows as Array<{ definition: string | null }>)[0]?.definition ?? null
        if (definition) {
          const [rows] = await conn.query(
            `SELECT TABLE_NAME AS name, IF(TABLE_TYPE = 'VIEW', 'view', 'table') AS kind
             FROM information_schema.tables
             WHERE TABLE_SCHEMA = DATABASE()
             ORDER BY TABLE_NAME`,
          )
          for (const row of rows as Array<{ name: string; kind: string }>) {
            if (definition.toLowerCase().includes(row.name.toLowerCase())) {
              addDependency(dependencies, {
                kind: row.kind as DependencyReference['kind'],
                name: row.name,
                detail: sourceSnippet(definition, row.name),
                source: 'definition text',
              })
            }
          }
        }
      }
      const routines = await queryOrNull<{ name: string }>(
        `SELECT ROUTINE_NAME AS name
         FROM information_schema.VIEW_ROUTINE_USAGE
         WHERE VIEW_SCHEMA = DATABASE() AND VIEW_NAME = ?
         ORDER BY ROUTINE_NAME`,
        [view],
      )
      if (routines) {
        for (const row of routines) {
          addDependency(dependencies, { kind: 'routine', name: row.name, detail: null, source: 'catalog' })
        }
      } else if (definition) {
        const [rows] = await conn.query(
          `SELECT ROUTINE_NAME AS name
           FROM information_schema.routines
           WHERE ROUTINE_SCHEMA = DATABASE()
           ORDER BY ROUTINE_NAME`,
        )
        for (const row of rows as Array<{ name: string }>) {
          if (definition.toLowerCase().includes(row.name.toLowerCase())) {
            addDependency(dependencies, {
              kind: 'routine',
              name: row.name,
              detail: sourceSnippet(definition, row.name),
              source: 'definition text',
            })
          }
        }
      }
      return { view, dependencies } as ViewDependenciesInfo
    },
    async getRoutineDependencies(name) {
      const [routineRows] = await conn.query(
        `SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS kind, ROUTINE_DEFINITION AS definition
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = ?
         ORDER BY ROUTINE_TYPE`,
        [name],
      )
      const routines = routineRows as Array<{ name: string; kind: string; definition: string | null }>
      if (routines.length === 0) throw new Error(`Routine "${name}" not found.`)
      const sourceText = routines.map(r => r.definition ?? '').join('\n')
      const dependencies: DependencyReference[] = []
      const tableUsage = await queryOrNull<{ table_name: string; kind: string }>(
        `SELECT DISTINCT r.TABLE_NAME AS table_name,
                IF(t.TABLE_TYPE = 'VIEW', 'view', 'table') AS kind
         FROM information_schema.ROUTINE_TABLE_USAGE r
         LEFT JOIN information_schema.tables t
           ON t.TABLE_SCHEMA = r.TABLE_SCHEMA AND t.TABLE_NAME = r.TABLE_NAME
         WHERE r.ROUTINE_SCHEMA = DATABASE() AND r.ROUTINE_NAME = ? AND r.TABLE_SCHEMA = DATABASE()
         ORDER BY r.TABLE_NAME`,
        [name],
      )
      if (tableUsage) {
        for (const row of tableUsage) {
          addDependency(dependencies, {
            kind: row.kind as DependencyReference['kind'],
            name: row.table_name,
            detail: null,
            source: 'catalog',
          })
        }
      } else {
        const [rows] = await conn.query(
          `SELECT TABLE_NAME AS name, IF(TABLE_TYPE = 'VIEW', 'view', 'table') AS kind
           FROM information_schema.tables
           WHERE TABLE_SCHEMA = DATABASE()
           ORDER BY TABLE_NAME`,
        )
        for (const row of rows as Array<{ name: string; kind: string }>) {
          if (sourceText.toLowerCase().includes(row.name.toLowerCase())) {
            addDependency(dependencies, {
              kind: row.kind as DependencyReference['kind'],
              name: row.name,
              detail: sourceSnippet(sourceText, row.name),
              source: 'definition text',
            })
          }
        }
      }
      const routineUsage = await queryOrNull<{ routine_name: string }>(
        `SELECT DISTINCT REFERENCED_ROUTINE_NAME AS routine_name
         FROM information_schema.ROUTINE_ROUTINE_USAGE
         WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = ? AND REFERENCED_ROUTINE_SCHEMA = DATABASE()
         ORDER BY REFERENCED_ROUTINE_NAME`,
        [name],
      )
      if (routineUsage) {
        for (const row of routineUsage) {
          addDependency(dependencies, { kind: 'routine', name: row.routine_name, detail: null, source: 'catalog' })
        }
      } else {
        const [rows] = await conn.query(
          `SELECT ROUTINE_NAME AS name
           FROM information_schema.routines
           WHERE ROUTINE_SCHEMA = DATABASE()
           ORDER BY ROUTINE_NAME`,
        )
        for (const row of rows as Array<{ name: string }>) {
          if (sourceText.toLowerCase().includes(row.name.toLowerCase())) {
            addDependency(dependencies, {
              kind: 'routine',
              name: row.name,
              detail: sourceSnippet(sourceText, row.name),
              source: 'definition text',
            })
          }
        }
      }
      return { name, dependencies } as RoutineDependenciesInfo
    },
    async getRoutineReferences(object) {
      const [rows] = await conn.query(
        `SELECT ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS name,
                ROUTINE_TYPE AS kind, ROUTINE_DEFINITION AS definition
         FROM information_schema.routines
         WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_DEFINITION LIKE ?
         ORDER BY ROUTINE_NAME
         LIMIT 100`,
        [`%${object}%`],
      )
      const list = rows as Array<{
        schema_name: string
        name: string
        kind: 'FUNCTION' | 'PROCEDURE'
        definition: string | null
      }>
      const references = list.map<RoutineReferenceInfo>(r => ({
        schema: r.schema_name,
        name: r.name,
        kind: r.kind.toLowerCase() as RoutineReferenceInfo['kind'],
        detail: r.definition ? sourceSnippet(r.definition, object) : null,
      }))
      return { object, references } as RoutineReferencesInfo
    },
    async getTriggerDependencies(name) {
      const [rows] = await conn.query(
        `SELECT TRIGGER_NAME AS trigger_name, EVENT_OBJECT_TABLE AS table_name,
                ACTION_STATEMENT AS statement
         FROM information_schema.triggers
         WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?`,
        [name],
      )
      const list = rows as Array<{
        trigger_name: string
        table_name: string
        statement: string | null
      }>
      if (list.length === 0) throw new Error(`Trigger "${name}" not found.`)
      const dependencies: DependencyReference[] = []
      for (const row of list) {
        addDependency(dependencies, {
          kind: 'table',
          name: row.table_name,
          detail: null,
          source: 'catalog',
        })
      }
      const routines = await queryOrNull<{ routine_name: string }>(
        `SELECT ROUTINE_NAME AS routine_name
         FROM information_schema.TRIGGER_ROUTINE_USAGE
         WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?
         ORDER BY ROUTINE_NAME`,
        [name],
      )
      if (routines) {
        for (const row of routines) {
          addDependency(dependencies, { kind: 'routine', name: row.routine_name, detail: null, source: 'catalog' })
        }
      } else {
        const statement = list.map(r => r.statement ?? '').join('\n')
        const [routineRows] = await conn.query(
          `SELECT ROUTINE_NAME AS name
           FROM information_schema.routines
           WHERE ROUTINE_SCHEMA = DATABASE()
           ORDER BY ROUTINE_NAME`,
        )
        for (const row of routineRows as Array<{ name: string }>) {
          if (statement.toLowerCase().includes(row.name.toLowerCase())) {
            addDependency(dependencies, {
              kind: 'routine',
              name: row.name,
              detail: sourceSnippet(statement, row.name),
              source: 'definition text',
            })
          }
        }
      }
      return { name, dependencies } as TriggerDependenciesInfo
    },
    async close() {
      await conn.end()
    },
  }
}
