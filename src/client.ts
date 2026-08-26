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

export interface ColumnStats {
  table: string
  column: string
  rowCount: number
  nonNullCount: number
  nullCount: number
  distinctCount: number
  distinctRatio: number | null
}

export interface FunctionSourceInfo {
  name: string
  kind: 'function' | 'procedure'
  arguments: string
  language: string | null
  source: string
}

export interface EnumTypeInfo {
  name: string
  values: string[]
}

export interface TableHealth {
  table: string
  supported: boolean
  seqScans: number | null
  indexScans: number | null
  liveRows: number | null
  deadRows: number | null
  lastVacuum: string | null
  lastAnalyze: string | null
}

export interface ActiveQueryInfo {
  id: string
  user: string
  database: string | null
  state: string | null
  durationSeconds: number | null
  query: string
}

export interface RoutineMatchInfo {
  name: string
  kind: 'function' | 'procedure'
  arguments: string
  language: string | null
}

export interface IndexMatchInfo {
  schema: string
  table: string
  name: string
  columns: string[]
  unique: boolean
}

export interface IndexUsageInfo {
  schema: string
  table: string
  index: string
  scans: number
  tuplesRead: number
  tuplesFetched: number
}

export interface LockInfo {
  pid: string
  user: string | null
  database: string | null
  state: string | null
  object: string | null
  lockType: string | null
  mode: string | null
  granted: boolean | null
  query: string | null
}

export interface TableAccessInfo {
  table: string
  supported: boolean
  lastSeqScan: string | null
  lastIdxScan: string | null
  seqScans: number | null
  indexScans: number | null
}

export interface ViewDefinitionMatchInfo {
  schema: string
  name: string
  definition: string | null
}

export interface RoutineDefinitionMatchInfo {
  schema: string
  name: string
  kind: 'function' | 'procedure'
  arguments: string
  language: string | null
  source: string | null
}

export interface TriggerDefinitionMatchInfo {
  schema: string
  table: string
  name: string
  timing: string
  event: string
  definition: string | null
}

export interface ConstraintDefinitionMatchInfo {
  schema: string
  table: string
  name: string
  type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK'
  definition: string | null
  simplified: boolean
}

export interface TableDefinitionMatchInfo {
  schema: string
  table: string
  definition: string
  simplified: boolean
}

export interface DependencyReference {
  kind: 'table' | 'view' | 'materialized view' | 'routine' | 'trigger' | 'foreign key'
  name: string
  detail: string | null
  source: 'catalog' | 'definition text'
}

export interface TableDependenciesInfo {
  table: string
  dependencies: DependencyReference[]
}

export interface ViewDependenciesInfo {
  view: string
  dependencies: DependencyReference[]
}

export interface RoutineDependenciesInfo {
  name: string
  dependencies: DependencyReference[]
}

export interface RoutineReferenceInfo {
  schema: string
  name: string
  kind: 'function' | 'procedure'
  detail: string | null
}

export interface RoutineReferencesInfo {
  object: string
  references: RoutineReferenceInfo[]
}

export interface TriggerDependenciesInfo {
  name: string
  dependencies: DependencyReference[]
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
  getColumnStats(table: string, column: string, signal?: AbortSignal): Promise<ColumnStats>
  getFunctionSource(name: string, signal?: AbortSignal): Promise<FunctionSourceInfo[]>
  listEnumTypes(signal?: AbortSignal): Promise<EnumTypeInfo[]>
  getTableHealth(table: string, signal?: AbortSignal): Promise<TableHealth>
  listActiveQueries(signal?: AbortSignal): Promise<ActiveQueryInfo[]>
  searchRoutines(pattern: string, signal?: AbortSignal): Promise<RoutineMatchInfo[]>
  searchIndexes(pattern: string, signal?: AbortSignal): Promise<IndexMatchInfo[]>
  listIndexUsage(signal?: AbortSignal): Promise<IndexUsageInfo[]>
  listLocks(signal?: AbortSignal): Promise<LockInfo[]>
  getTableLastAccess(table: string, signal?: AbortSignal): Promise<TableAccessInfo>
  searchViewDefinitions(pattern: string, signal?: AbortSignal): Promise<ViewDefinitionMatchInfo[]>
  searchRoutineDefinitions(pattern: string, signal?: AbortSignal): Promise<RoutineDefinitionMatchInfo[]>
  searchTriggerDefinitions(pattern: string, signal?: AbortSignal): Promise<TriggerDefinitionMatchInfo[]>
  searchConstraintDefinitions(pattern: string, signal?: AbortSignal): Promise<ConstraintDefinitionMatchInfo[]>
  searchTableDefinitions(pattern: string, signal?: AbortSignal): Promise<TableDefinitionMatchInfo[]>
  getTableDependencies(table: string, signal?: AbortSignal): Promise<TableDependenciesInfo>
  getViewDependencies(view: string, signal?: AbortSignal): Promise<ViewDependenciesInfo>
  getRoutineDependencies(name: string, signal?: AbortSignal): Promise<RoutineDependenciesInfo>
  getRoutineReferences(object: string, signal?: AbortSignal): Promise<RoutineReferencesInfo>
  getTriggerDependencies(name: string, signal?: AbortSignal): Promise<TriggerDependenciesInfo>
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

  async getColumnStats(table: string, column: string, signal?: AbortSignal): Promise<ColumnStats> {
    assertSafeIdentifier(table, 'table name')
    assertSafeIdentifier(column, 'column name')
    const driver = await this.getDriver()
    try {
      return await driver.getColumnStats(table, column, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getFunctionSource(name: string, signal?: AbortSignal): Promise<FunctionSourceInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.getFunctionSource(name, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listEnumTypes(signal?: AbortSignal): Promise<EnumTypeInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listEnumTypes(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTableHealth(table: string, signal?: AbortSignal): Promise<TableHealth> {
    assertSafeIdentifier(table, 'table name')
    const driver = await this.getDriver()
    try {
      return await driver.getTableHealth(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listActiveQueries(signal?: AbortSignal): Promise<ActiveQueryInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listActiveQueries(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchRoutines(pattern: string, signal?: AbortSignal): Promise<RoutineMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchRoutines(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchIndexes(pattern: string, signal?: AbortSignal): Promise<IndexMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchIndexes(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listIndexUsage(signal?: AbortSignal): Promise<IndexUsageInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listIndexUsage(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async listLocks(signal?: AbortSignal): Promise<LockInfo[]> {
    const driver = await this.getDriver()
    try {
      return await driver.listLocks(this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTableLastAccess(table: string, signal?: AbortSignal): Promise<TableAccessInfo> {
    assertSafeIdentifier(table, 'table name')
    const driver = await this.getDriver()
    try {
      return await driver.getTableLastAccess(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchViewDefinitions(pattern: string, signal?: AbortSignal): Promise<ViewDefinitionMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchViewDefinitions(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchRoutineDefinitions(pattern: string, signal?: AbortSignal): Promise<RoutineDefinitionMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchRoutineDefinitions(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchTriggerDefinitions(pattern: string, signal?: AbortSignal): Promise<TriggerDefinitionMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchTriggerDefinitions(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchConstraintDefinitions(pattern: string, signal?: AbortSignal): Promise<ConstraintDefinitionMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchConstraintDefinitions(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async searchTableDefinitions(pattern: string, signal?: AbortSignal): Promise<TableDefinitionMatchInfo[]> {
    const driver = await this.getDriver()
    try {
      const normalized = pattern.includes('%') ? pattern : `%${pattern}%`
      return await driver.searchTableDefinitions(normalized, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTableDependencies(table: string, signal?: AbortSignal): Promise<TableDependenciesInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getTableDependencies(table, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getViewDependencies(view: string, signal?: AbortSignal): Promise<ViewDependenciesInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getViewDependencies(view, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getRoutineDependencies(name: string, signal?: AbortSignal): Promise<RoutineDependenciesInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getRoutineDependencies(name, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getRoutineReferences(object: string, signal?: AbortSignal): Promise<RoutineReferencesInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getRoutineReferences(object, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }

  async getTriggerDependencies(name: string, signal?: AbortSignal): Promise<TriggerDependenciesInfo> {
    const driver = await this.getDriver()
    try {
      return await driver.getTriggerDependencies(name, this.combinedSignal(signal))
    } catch (error) {
      if (error instanceof SqlError) throw error
      throw new SqlError(error instanceof Error ? error.message : String(error), 'query')
    }
  }
}
