/** Read-only SQL client with injected driver adapter for testability. */

export interface DbConfig {
  type: 'postgres' | 'mysql'
  host: string
  port?: number
  user: string
  password: string
  database: string
  /** Connection timeout in ms (default 10000). */
  connectTimeoutMs?: number
  /** Query timeout in ms (default 15000). */
  timeoutMs?: number
  /** Max rows returned (default 100). */
  maxRows?: number
  ssl?: boolean
}

export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  rowCount: number
  truncated: boolean
}

export interface TableInfo {
  name: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

export interface DatabaseInfo {
  version: string
  database: string
  user: string
  serverTime: string
}

export interface TableStat {
  table: string
  schema: string
  estimatedRows: number
}

export interface ColumnMatch {
  table: string
  column: string
  type: string
}

export interface ViewInfo {
  name: string
  definition: string | null
}

export interface TableSize {
  table: string
  dataBytes: number
  indexBytes: number
  totalBytes: number
}

export interface SchemaInfo {
  table: string
  ddl: string
  /** True when the DDL was generated from catalog metadata (PostgreSQL) rather than the server's own output. */
  simplified: boolean
}

export interface PingResult {
  ok: boolean
  latencyMs: number
}

export interface FunctionInfo {
  name: string
  arguments: string
  language: string | null
  returnType: string | null
}

export interface TriggerInfo {
  name: string
  table: string
  timing: string
  event: string
  definition: string | null
}

export interface ForeignKeyInfo {
  name: string
  table: string
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface SchemaDump {
  tables: Array<{ table: string; ddl: string; simplified: boolean }>
  views: Array<{ name: string; definition: string }>
}

export interface ExtensionInfo {
  name: string
  version: string | null
}

export interface SequenceInfo {
  name: string
  dataType: string | null
  startValue: string | null
  increment: string | null
}

export interface ConstraintInfo {
  name: string
  table: string
  type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK'
  columns: string[]
  definition: string | null
}

export interface DatabaseItem {
  name: string
}

export interface RoleInfo {
  name: string
  roleType: 'role' | 'account'
  attributes: string[]
  detail: string | null
}

export interface GrantInfo {
  grantee: string
  object: string
  privilege: string
  grantable: boolean
}

export interface MaterializedViewInfo {
  name: string
  definition: string | null
}

export interface PartitionInfo {
  parent: string | null
  partition: string
  method: string | null
  bound: string | null
  estimatedRows: number | null
}

export interface TableRowCount {
  table: string
  rowCount: number
}

export interface TableMatch {
  schema: string
  name: string
  kind: 'table' | 'view' | 'materialized view'
}

export interface DatabaseSize {
  database: string
  totalBytes: number
  dataBytes: number | null
  indexBytes: number | null
}

export interface TableSizeItem {
  schema: string
  table: string
  dataBytes: number
  indexBytes: number
  totalBytes: number
}

export interface ColumnComment {
  name: string
  comment: string | null
}

export interface TableCommentInfo {
  table: string
  tableComment: string | null
  columns: ColumnComment[]
}

/** SQL driver adapter; implementations live in drivers/* and are dynamically imported. */
export interface Driver {
  query(sql: string, signal?: AbortSignal): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>
  listTables(signal?: AbortSignal): Promise<string[]>
  describeTable(table: string, signal?: AbortSignal): Promise<ColumnInfo[]>
  listIndexes(table: string, signal?: AbortSignal): Promise<IndexInfo[]>
  databaseInfo(signal?: AbortSignal): Promise<DatabaseInfo>
  tableStats(signal?: AbortSignal): Promise<TableStat[]>
  searchColumns(pattern: string, signal?: AbortSignal): Promise<ColumnMatch[]>
  listViews(signal?: AbortSignal): Promise<ViewInfo[]>
  tableSize(table: string, signal?: AbortSignal): Promise<TableSize>
  getSchema(table: string, signal?: AbortSignal): Promise<SchemaInfo>
  previewTable(table: string, limit: number, signal?: AbortSignal): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>
  listFunctions(signal?: AbortSignal): Promise<FunctionInfo[]>
  listTriggers(signal?: AbortSignal): Promise<TriggerInfo[]>
  listForeignKeys(signal?: AbortSignal): Promise<ForeignKeyInfo[]>
  schemaDump(signal?: AbortSignal): Promise<SchemaDump>
  listExtensions(signal?: AbortSignal): Promise<ExtensionInfo[]>
  listSchemas(signal?: AbortSignal): Promise<string[]>
  listSequences(signal?: AbortSignal): Promise<SequenceInfo[]>
  listConstraints(signal?: AbortSignal): Promise<ConstraintInfo[]>
  listDatabases(signal?: AbortSignal): Promise<DatabaseItem[]>
  listRoles(signal?: AbortSignal): Promise<RoleInfo[]>
  listGrants(signal?: AbortSignal): Promise<GrantInfo[]>
  listMaterializedViews(signal?: AbortSignal): Promise<MaterializedViewInfo[]>
  listPartitions(signal?: AbortSignal): Promise<PartitionInfo[]>
  getTableRowCount(table: string, signal?: AbortSignal): Promise<TableRowCount>
  searchTables(pattern: string, signal?: AbortSignal): Promise<TableMatch[]>
  databaseSize(signal?: AbortSignal): Promise<DatabaseSize>
  listTableSizes(signal?: AbortSignal): Promise<TableSizeItem[]>
  getTableComments(table: string, signal?: AbortSignal): Promise<TableCommentInfo>
  listIncomingForeignKeys(table: string, signal?: AbortSignal): Promise<ForeignKeyInfo[]>
  close(): Promise<void>
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Reject anything that is not a plain SQL identifier (table/column names). */
export function assertSafeIdentifier(name: string, what = 'identifier'): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new SqlError(`Invalid ${what}: "${name}". Only letters, digits, and underscores are allowed.`, 'denied')
  }
}

export class SqlError extends Error {
  constructor(message: string, readonly kind: 'unsupported' | 'denied' | 'timeout' | 'connection' | 'query' = 'query') {
    super(message)
  }
}

const READ_ONLY_PREFIXES = ['select', 'explain', 'show', 'describe', 'desc', 'with', 'pragma', 'values']
const WRITE_KEYWORDS = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|rename|replace|merge|call|exec|copy|vacuum)\b/i

export function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/[;(\s]+$/, '')
  if (!trimmed) throw new SqlError('Empty SQL statement.', 'denied')
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!READ_ONLY_PREFIXES.includes(firstWord)) {
    throw new SqlError(`Statement not allowed: "${firstWord}". Only read-only queries are permitted.`, 'denied')
  }
  if (WRITE_KEYWORDS.test(trimmed)) {
    throw new SqlError('Statement contains write keywords (INSERT/UPDATE/DELETE/DDL). Read-only mode is enforced.', 'denied')
  }
}

export class DbClient {
  private readonly config: DbConfig
  private readonly driver: Driver | null
  private readonly maxRows: number
  private readonly timeoutMs: number
  /** Database type as configured ('postgres' | 'mysql'). */
  readonly databaseType: DbConfig['type']

  constructor(config: DbConfig, driver?: Driver) {
    this.config = config
    this.driver = driver ?? null
    this.maxRows = config.maxRows ?? 100
    this.timeoutMs = config.timeoutMs ?? 15_000
    this.databaseType = config.type
  }

  private combinedSignal(signal?: AbortSignal): AbortSignal | undefined {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
  }

  private async getDriver(): Promise<Driver> {
    if (this.driver) return this.driver
    if (this.config.type === 'postgres') {
      const { createPostgresDriver } = await import('./drivers/postgres.js')
      return createPostgresDriver(this.config)
    }
    if (this.config.type === 'mysql') {
      const { createMysqlDriver } = await import('./drivers/mysql.js')
      return createMysqlDriver(this.config)
    }
    throw new SqlError(`Unsupported database type: ${this.config.type}`, 'unsupported')
  }

  async query(sql: string, signal?: AbortSignal, maxRowsOverride?: number): Promise<QueryResult> {
    assertReadOnly(sql)
    const driver = await this.getDriver()
    const maxRows = maxRowsOverride === undefined ? this.maxRows : Math.min(maxRowsOverride, this.maxRows)
    try {
      const result = await driver.query(sql, this.combinedSignal(signal))
      const truncated = result.rows.length > maxRows
      return {
        columns: result.columns,
        rows: truncated ? result.rows.slice(0, maxRows) : result.rows,
        rowCount: result.rows.length,
        truncated,
      }
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listTables(signal?: AbortSignal): Promise<string[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listTables(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async describeTable(table: string, signal?: AbortSignal): Promise<ColumnInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.describeTable(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listIndexes(table: string, signal?: AbortSignal): Promise<IndexInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listIndexes(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async databaseInfo(signal?: AbortSignal): Promise<DatabaseInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.databaseInfo(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async tableStats(signal?: AbortSignal): Promise<TableStat[]> {
    const driver = await this.getDriver()
    try {
      return await driver.tableStats(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchColumns(pattern: string, signal?: AbortSignal): Promise<ColumnMatch[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchColumns(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async ping(signal?: AbortSignal): Promise<PingResult> {
    const start = performance.now()
    await this.query('SELECT 1', signal)
    return { ok: true, latencyMs: Math.round(performance.now() - start) }
  }

  async listViews(signal?: AbortSignal): Promise<ViewInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listViews(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listSchemas(signal?: AbortSignal): Promise<string[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listSchemas(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listDatabases(signal?: AbortSignal): Promise<DatabaseItem[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listDatabases(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listRoles(signal?: AbortSignal): Promise<RoleInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listRoles(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listGrants(signal?: AbortSignal): Promise<GrantInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listGrants(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listMaterializedViews(signal?: AbortSignal): Promise<MaterializedViewInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listMaterializedViews(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listPartitions(signal?: AbortSignal): Promise<PartitionInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listPartitions(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTableRowCount(table: string, signal?: AbortSignal): Promise<TableRowCount> {
    assertSafeIdentifier(table, 'table name')
    const driver = await this.getDriver()
    try {
      return await driver.getTableRowCount(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listSequences(signal?: AbortSignal): Promise<SequenceInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listSequences(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listConstraints(signal?: AbortSignal): Promise<ConstraintInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listConstraints(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async tableSize(table: string, signal?: AbortSignal): Promise<TableSize> {
    const driver = await this.getDriver()
    try {
      return await driver.tableSize(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getSchema(table: string, signal?: AbortSignal): Promise<SchemaInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getSchema(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async previewTable(table: string, limit: number, signal?: AbortSignal): Promise<QueryResult> {
    assertSafeIdentifier(table, 'table name')
    const driver = await this.getDriver()
    try {
      const result = await driver.previewTable(table, limit, this.combinedSignal(signal))
      const truncated = result.rows.length > limit
      return {
        columns: result.columns,
        rows: truncated ? result.rows.slice(0, limit) : result.rows,
        rowCount: result.rows.length,
        truncated,
      }
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listFunctions(signal?: AbortSignal): Promise<FunctionInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listFunctions(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listTriggers(signal?: AbortSignal): Promise<TriggerInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listTriggers(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listForeignKeys(signal?: AbortSignal): Promise<ForeignKeyInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listForeignKeys(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async schemaDump(signal?: AbortSignal): Promise<SchemaDump> {
    const driver = await this.getDriver()
    try {
      return await driver.schemaDump(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listExtensions(signal?: AbortSignal): Promise<ExtensionInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listExtensions(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchTables(pattern: string, signal?: AbortSignal): Promise<TableMatch[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchTables(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async databaseSize(signal?: AbortSignal): Promise<DatabaseSize> {
    const driver = await this.getDriver()
    try {
      return await driver.databaseSize(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listTableSizes(signal?: AbortSignal): Promise<TableSizeItem[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listTableSizes(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTableComments(table: string, signal?: AbortSignal): Promise<TableCommentInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getTableComments(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listIncomingForeignKeys(table: string, signal?: AbortSignal): Promise<ForeignKeyInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listIncomingForeignKeys(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }
}
