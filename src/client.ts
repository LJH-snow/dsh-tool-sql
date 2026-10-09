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
  /** Max columns returned per query (default 100). */
  maxColumns?: number
  /** Max serialized query result bytes (default 1 MiB). */
  maxBytes?: number
  /** Verify the database certificate when TLS is enabled (default true). */
  sslRejectUnauthorized?: boolean
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
    this.name = 'SqlError'
  }
}

const READ_ONLY_PREFIXES = ['select', 'explain', 'show', 'describe', 'desc', 'with', 'pragma', 'values']
const WRITE_KEYWORDS = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|rename|replace|merge|call|exec|copy|vacuum|set|reset|begin|start|commit|rollback|savepoint|release|lock|unlock|load|prepare|execute|deallocate|listen|notify|handler|use|do|returning)\b/i
const DANGEROUS_FUNCTIONS = /(?:^|[^A-Za-z0-9_$])(?:["`]?)(?:set_config|setval|nextval|currval|lastval|pg_write_file|pg_read_file|pg_read_binary_file|pg_stat_file|pg_ls_dir|pg_ls_logdir|pg_ls_waldir|pg_logdir_ls|pg_execute_server_program|pg_reload_conf|pg_rotate_logfile|pg_notify|dblink_exec|dblink_connect|dblink_connect_u|dblink_send_query|lo_import|lo_export|lo_create|pg_terminate_backend|pg_cancel_backend|pg_(?:try_)?advisory_(?:xact_)?(?:lock|unlock)(?:_shared|_all)?|pg_stat_reset(?:_shared|_single_table_counters)?|pg_log_backend_memory_contexts|pg_sleep|pg_sleep_for|pg_sleep_until|current_setting|sys_exec|sys_eval|load_file|get_lock|release_(?:all_)?locks?|sleep|benchmark|master_pos_wait|wait_for_executed_gtid_set)(?:["`]?)\s*\(/i
const DANGEROUS_CLAUSES = /\b(?:explain\s+(?:analyze\b|\([^)]*\banalyze\b)|for\s+(?:no\s+key\s+update|key\s+share|update|share)|lock\s+in\s+share\s+mode|into\s+(?:out|dump)file|load\s+data\s+(?:local\s+)?infile|into\s+(?:(?:temporary|temp|unlogged)\s+)?(?:table\s+)?(?:"[^"\r\n]+"|`[^`\r\n]+`|[A-Za-z_][A-Za-z0-9_$]*|@))(?=\s|$)/i
const DEFAULT_MAX_ROWS = 100
const DEFAULT_MAX_COLUMNS = 100
const DEFAULT_MAX_BYTES = 1024 * 1024

function positiveLimit(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value > 0 ? Math.max(1, Math.floor(value)) : fallback
}

function jsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'bigint') return item.toString()
      return item
    }) ?? '')
  } catch {
    return Buffer.byteLength(String(value))
  }
}

function isSqlCommentStart(sql: string, index: number, hashComments: boolean): 'line' | 'block' | null {
  if (hashComments && sql[index] === '#') return 'line'
  if (sql[index] === '-' && sql[index + 1] === '-' && /\s/.test(sql[index + 2] ?? '')) return 'line'
  if (sql[index] === '/' && sql[index + 1] === '*') return 'block'
  return null
}

/** Remove comments before the first SQL token, preserving quoted values. */
function stripLeadingSqlTrivia(sql: string): string {
  let index = 0
  while (index < sql.length) {
    while (/\s/.test(sql[index] ?? '')) index += 1
    if (sql[index] === '#' || (sql[index] === '-' && sql[index + 1] === '-' && /\s/.test(sql[index + 2] ?? ''))) {
      const newline = sql.indexOf('\n', index + 1)
      index = newline < 0 ? sql.length : newline + 1
      continue
    }
    if (sql[index] === '/' && sql[index + 1] === '*') {
      const end = sql.indexOf('*/', index + 2)
      index = end < 0 ? sql.length : end + 2
      continue
    }
    break
  }
  return sql.slice(index)
}

interface SqlCommentMode {
  backslashEscapes: boolean
  hashComments: boolean
  dollarQuotes: boolean
  nestedBlockComments: boolean
}

/** Remove comments only when the scanner is outside quoted SQL text. */
function stripSqlCommentsWithMode(sql: string, mode: SqlCommentMode): string {
  let output = ''
  let quote: '\'' | '"' | '`' | null = null
  let dollarTag: string | null = null
  let lineComment = false
  let blockDepth = 0

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      if (char === '\n' || char === '\r') {
        lineComment = false
        output += char
      } else {
        output += ' '
      }
      continue
    }

    if (blockDepth > 0) {
      if (mode.nestedBlockComments && char === '/' && next === '*') {
        blockDepth += 1
        output += '  '
        index += 1
      } else if (char === '*' && next === '/') {
        blockDepth -= 1
        output += '  '
        index += 1
      } else {
        output += char === '\n' || char === '\r' ? char : ' '
      }
      continue
    }

    if (dollarTag) {
      output += char
      if (sql.startsWith(dollarTag, index)) {
        output += sql.slice(index + 1, index + dollarTag.length)
        index += dollarTag.length - 1
        dollarTag = null
      }
      continue
    }

    if (quote) {
      output += char
      if (mode.backslashEscapes && char === '\\') {
        if (next !== undefined) { output += next; index += 1 }
      } else if (char === quote) {
        if (next === quote) { output += next; index += 1 }
        else quote = null
      }
      continue
    }

    const commentStart = isSqlCommentStart(sql, index, mode.hashComments)
    if (commentStart === 'line') {
      lineComment = true
      output += ' '
      continue
    }
    if (commentStart === 'block' && !sql.startsWith('/*!', index) && !/^\/\*M!/i.test(sql.slice(index))) {
      blockDepth = 1
      output += ' '
      index += 1
      continue
    }

    if (mode.dollarQuotes && char === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(index))?.[0]
      if (tag) {
        dollarTag = tag
        output += tag
        index += tag.length - 1
        continue
      }
    }

    if (char === '\'' || char === '"' || char === '`') quote = char
    output += char
  }

  return output
}

/** Normalize comments under PostgreSQL and MySQL quoting rules. */
function stripSqlComments(sql: string): string {
  const postgres = stripSqlCommentsWithMode(sql, {
    backslashEscapes: false,
    hashComments: false,
    dollarQuotes: true,
    nestedBlockComments: true,
  })
  const mysql = stripSqlCommentsWithMode(sql, {
    backslashEscapes: true,
    hashComments: true,
    dollarQuotes: false,
    nestedBlockComments: false,
  })
  return `${postgres}\n${mysql}`
}

/** Return true when a semicolon separates two executable statements. */
function hasMultipleStatementsWithEscapes(sql: string, backslashEscapes: boolean, hashComments: boolean): boolean {
  let quote: '\'' | '"' | '`' | null = null
  let dollarTag: string | null = null
  let comment: 'line' | 'block' | null = null
  let separatorSeen = false
  let executableTextAfterSeparator = false

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (comment === 'line') {
      if (char === '\n' || char === '\r') comment = null
      continue
    }
    if (comment === 'block') {
      if (char === '*' && next === '/') { comment = null; i += 1 }
      continue
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { i += dollarTag.length - 1; dollarTag = null }
      continue
    }
    if (quote) {
      if (backslashEscapes && char === '\\') { i += 1; continue }
      if (char === quote) {
        if (next === quote) { i += 1; continue }
        quote = null
      }
      continue
    }

    const commentStart = isSqlCommentStart(sql, i, hashComments)
    if (commentStart) { comment = commentStart; if (commentStart === 'block') i += 1; continue }
    if (char === '\'' || char === '"' || char === '`') { quote = char; continue }
    if (char === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))?.[0]
      if (tag) { dollarTag = tag; i += tag.length - 1; continue }
    }
    if (char === ';') {
      if (separatorSeen) return true
      separatorSeen = true
      executableTextAfterSeparator = false
      continue
    }
    if (separatorSeen && !/\s/.test(char)) executableTextAfterSeparator = true
  }
  return executableTextAfterSeparator
}

/**
 * Parse both PostgreSQL standard-conforming strings and MySQL backslash
 * strings. If either interpretation sees a second executable statement, deny
 * the query rather than letting a dialect mismatch bypass the guard.
 */
function hasMultipleStatements(sql: string): boolean {
  return [true, false].some(backslashEscapes => [true, false].some(hashComments =>
    hasMultipleStatementsWithEscapes(sql, backslashEscapes, hashComments)))
}

export function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/[;\s]+$/, '')
  if (!trimmed) throw new SqlError('Empty SQL statement.', 'denied')
  if (hasMultipleStatements(sql)) {
    throw new SqlError('Multiple SQL statements are not allowed.', 'denied')
  }
  const firstWord = stripLeadingSqlTrivia(trimmed).split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!READ_ONLY_PREFIXES.includes(firstWord)) {
    throw new SqlError(`Statement not allowed: "${firstWord}". Only read-only queries are permitted.`, 'denied')
  }
  if (WRITE_KEYWORDS.test(trimmed)) {
    throw new SqlError('Statement contains write keywords (INSERT/UPDATE/DELETE/DDL). Read-only mode is enforced.', 'denied')
  }
  const normalized = stripSqlComments(trimmed)
  const withoutQuotedText = normalized.replace(/'(?:''|\\.|[^'])*'|"(?:""|[^"])*"/g, ' ')
  if (DANGEROUS_FUNCTIONS.test(normalized) || DANGEROUS_CLAUSES.test(normalized) || /\binto\b/i.test(withoutQuotedText)) {
    throw new SqlError('Statement contains a function or clause that can mutate, lock, access files, or execute external work.', 'denied')
  }
}

export class DbClient {
  private readonly config: DbConfig
  private readonly driver: Driver | null
  private readonly maxRows: number
  private readonly maxColumns: number
  private readonly maxBytes: number
  private readonly timeoutMs: number
  /** Database type as configured ('postgres' | 'mysql'). */
  readonly databaseType: DbConfig['type']

  constructor(config: DbConfig, driver?: Driver) {
    this.config = config
    this.driver = driver ?? null
    this.maxRows = positiveLimit(config.maxRows, DEFAULT_MAX_ROWS)
    this.maxColumns = positiveLimit(config.maxColumns, DEFAULT_MAX_COLUMNS)
    this.maxBytes = positiveLimit(config.maxBytes, DEFAULT_MAX_BYTES)
    this.timeoutMs = positiveLimit(config.timeoutMs, 15_000)
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
      const sourceColumns = result.columns.length > 0 ? result.columns : Object.keys(result.rows[0] ?? {})
      const columns = sourceColumns.slice(0, this.maxColumns)
      const truncatedByColumns = sourceColumns.length > columns.length
      const rows: Array<Record<string, unknown>> = []
      const rowCount = result.rows.length
      let truncatedByBytes = false
      // Include the complete tool envelope in the budget so renderers and
      // transport serialization cannot exceed maxBytes after this layer.
      const base = { columns, rows, rowCount, truncated: true }
      while (jsonBytes(base) > this.maxBytes && columns.length > 0) columns.pop()
      for (const sourceRow of result.rows.slice(0, maxRows)) {
        const row: Record<string, unknown> = {}
        for (const column of columns) {
          if (Object.prototype.hasOwnProperty.call(sourceRow, column)) row[column] = sourceRow[column]
        }
        rows.push(row)
        if (jsonBytes(base) > this.maxBytes) {
          rows.pop()
          truncatedByBytes = true
          break
        }
      }
      const truncated = rowCount > maxRows || truncatedByColumns || truncatedByBytes || rows.length < Math.min(rowCount, maxRows)
      return {
        columns,
        rows,
        rowCount,
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
      const maxRows = Math.min(positiveLimit(limit, 1), this.maxRows)
      const sourceColumns = result.columns.length > 0 ? result.columns : Object.keys(result.rows[0] ?? {})
      const columns = sourceColumns.slice(0, this.maxColumns)
      const rows: Array<Record<string, unknown>> = []
      const rowCount = result.rows.length
      let truncatedByBytes = false
      const base = { columns, rows, rowCount, truncated: true }
      while (jsonBytes(base) > this.maxBytes && columns.length > 0) columns.pop()
      for (const sourceRow of result.rows.slice(0, maxRows)) {
        const row: Record<string, unknown> = {}
        for (const column of columns) {
          if (Object.prototype.hasOwnProperty.call(sourceRow, column)) row[column] = sourceRow[column]
        }
        rows.push(row)
        if (jsonBytes(base) > this.maxBytes) {
          rows.pop()
          truncatedByBytes = true
          break
        }
      }
      return {
        columns,
        rows,
        rowCount,
        truncated: rowCount > maxRows || sourceColumns.length > columns.length || truncatedByBytes || rows.length < Math.min(rowCount, maxRows),
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
