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

/** SQL driver adapter; implementations live in drivers/* and are dynamically imported. */
export interface Driver {
  query(sql: string, signal?: AbortSignal): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>
  listTables(signal?: AbortSignal): Promise<string[]>
  describeTable(table: string, signal?: AbortSignal): Promise<ColumnInfo[]>
  listIndexes(table: string, signal?: AbortSignal): Promise<IndexInfo[]>
  databaseInfo(signal?: AbortSignal): Promise<DatabaseInfo>
  tableStats(signal?: AbortSignal): Promise<TableStat[]>
  searchColumns(pattern: string, signal?: AbortSignal): Promise<ColumnMatch[]>
  close(): Promise<void>
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

  constructor(config: DbConfig, driver?: Driver) {
    this.config = config
    this.driver = driver ?? null
    this.maxRows = config.maxRows ?? 100
    this.timeoutMs = config.timeoutMs ?? 15_000
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

  async query(sql: string, signal?: AbortSignal): Promise<QueryResult> {
    assertReadOnly(sql)
    const driver = await this.getDriver()
    try {
      const result = await driver.query(sql, this.combinedSignal(signal))
      const truncated = result.rows.length > this.maxRows
      return {
        columns: result.columns,
        rows: truncated ? result.rows.slice(0, this.maxRows) : result.rows,
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
}
