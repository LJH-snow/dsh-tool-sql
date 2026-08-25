import type { Driver, DbConfig, ColumnInfo, IndexInfo, DatabaseInfo, TableStat, ColumnMatch, ViewInfo, TableSize, SchemaInfo, FunctionInfo, TriggerInfo, ForeignKeyInfo, SchemaDump, ExtensionInfo, SequenceInfo, ConstraintInfo, DatabaseItem, RoleInfo, GrantInfo, MaterializedViewInfo, PartitionInfo, TableRowCount, TableMatch, DatabaseSize, TableSizeItem, TableCommentInfo, ColumnStats, FunctionSourceInfo, EnumTypeInfo, TableHealth, ActiveQueryInfo, RoutineMatchInfo, IndexMatchInfo, IndexUsageInfo, LockInfo, TableAccessInfo, ViewDefinitionMatchInfo, RoutineDefinitionMatchInfo, TriggerDefinitionMatchInfo, ConstraintDefinitionMatchInfo, TableDefinitionMatchInfo } from '../client.js'
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

  async function listConstraints(): Promise<ConstraintInfo[]> {
    const result = await client.query<{
      name: string
      table: string
      type: string
      definition: string
      columns: string[] | null
    }>(
      `SELECT con.conname AS name,
              c.relname AS table,
              CASE con.contype
                WHEN 'p' THEN 'PRIMARY KEY'
                WHEN 'u' THEN 'UNIQUE'
                WHEN 'c' THEN 'CHECK'
              END AS type,
              pg_get_constraintdef(con.oid) AS definition,
              COALESCE(
                array_agg(a.attname ORDER BY k.ord) FILTER (WHERE a.attname IS NOT NULL),
                ARRAY[]::text[]
              ) AS columns
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
       LEFT JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
       WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'c') AND con.conrelid <> 0
       GROUP BY con.oid, con.conname, c.relname, con.contype
       ORDER BY c.relname, con.conname`,
    )
    return result.rows.map<ConstraintInfo>(r => ({
      name: r.name,
      table: r.table,
      type: r.type as ConstraintInfo['type'],
      columns: r.columns ?? [],
      definition: r.definition,
    }))
  }

  function parseTrigger(definition: string): { timing: string; event: string } {
    const match = /CREATE TRIGGER \S+ (BEFORE|AFTER|INSTEAD OF) (INSERT|UPDATE|DELETE|TRUNCATE)/.exec(definition)
    return { timing: match?.[1] ?? '', event: match?.[2] ?? '' }
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
    async listSchemas() {
      const result = await client.query<{ schema_name: string }>(
        `SELECT nspname AS schema_name
         FROM pg_namespace
         WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
         ORDER BY nspname`,
      )
      return result.rows.map(r => r.schema_name)
    },
    async listDatabases() {
      const result = await client.query<{ name: string }>(
        `SELECT datname AS name
         FROM pg_database
         WHERE datistemplate = false
         ORDER BY datname`,
      )
      return result.rows.map<DatabaseItem>(r => ({ name: r.name }))
    },
    async listRoles() {
      const result = await client.query<{
        name: string
        superuser: boolean
        can_login: boolean
        can_create_db: boolean
        can_create_role: boolean
        connection_limit: number | null
      }>(
        `SELECT rolname AS name, rolsuper AS superuser, rolcanlogin AS can_login,
                rolcreatedb AS can_create_db, rolcreaterole AS can_create_role,
                rolconnlimit AS connection_limit
         FROM pg_roles
         ORDER BY rolname`,
      )
      return result.rows.map<RoleInfo>(r => {
        const attributes: string[] = []
        if (r.superuser) attributes.push('superuser')
        if (r.can_create_db) attributes.push('create database')
        if (r.can_create_role) attributes.push('create role')
        if (r.can_login) attributes.push('can login')
        return {
          name: r.name,
          roleType: 'role',
          attributes,
          detail: r.connection_limit === -1 ? 'no connection limit' : `connection limit: ${r.connection_limit ?? 0}`,
        }
      })
    },
    async listGrants() {
      const result = await client.query<{
        grantee: string
        object: string
        privilege: string
        grantable: string
      }>(
        `SELECT grantee, table_schema || '.' || table_name AS object,
                privilege_type AS privilege, is_grantable AS grantable
         FROM information_schema.role_table_grants
         WHERE table_schema = 'public'
         ORDER BY grantee, object, privilege`,
      )
      return result.rows.map<GrantInfo>(r => ({
        grantee: r.grantee,
        object: r.object,
        privilege: r.privilege,
        grantable: r.grantable === 'YES',
      }))
    },
    async listMaterializedViews() {
      const result = await client.query<{ name: string; definition: string | null }>(
        `SELECT matviewname AS name, definition
         FROM pg_matviews
         WHERE schemaname = 'public'
         ORDER BY matviewname`,
      )
      return result.rows.map<MaterializedViewInfo>(r => ({ name: r.name, definition: r.definition }))
    },
    async listPartitions() {
      const result = await client.query<{
        parent: string
        partition: string
        method: string
        bound: string | null
        estimated_rows: string
      }>(
        `SELECT parent.relname AS parent, child.relname AS partition,
                CASE pt.partstrat WHEN 'h' THEN 'HASH' WHEN 'r' THEN 'RANGE' WHEN 'l' THEN 'LIST' END AS method,
                pg_get_expr(child.relpartbound, child.oid) AS bound,
                child.reltuples::bigint AS estimated_rows
         FROM pg_inherits inh
         JOIN pg_class parent ON parent.oid = inh.inhparent
         JOIN pg_class child ON child.oid = inh.inhrelid
         JOIN pg_namespace n ON n.oid = child.relnamespace
         JOIN pg_partitioned_table pt ON pt.partrelid = parent.oid
         WHERE n.nspname = 'public'
         ORDER BY parent.relname, child.relname`,
      )
      return result.rows.map<PartitionInfo>(r => ({
        parent: r.parent,
        partition: r.partition,
        method: r.method,
        bound: r.bound,
        estimatedRows: Number(r.estimated_rows ?? 0),
      }))
    },
    async getTableRowCount(table) {
      assertSafeIdentifier(table, 'table name')
      const result = await client.query<{ row_count: string }>(`SELECT COUNT(*) AS row_count FROM "${table}"`)
      const row = result.rows[0]
      return { table, rowCount: Number(row?.row_count ?? 0) } as TableRowCount
    },
    async listSequences() {
      const result = await client.query<{ name: string; data_type: string; start_value: string; increment: string }>(
        `SELECT sequence_name AS name, data_type, start_value, increment
         FROM information_schema.sequences
         WHERE sequence_schema = 'public'
         ORDER BY sequence_name`,
      )
      return result.rows.map<SequenceInfo>(r => ({
        name: r.name,
        dataType: r.data_type,
        startValue: r.start_value,
        increment: r.increment,
      }))
    },
    async listConstraints() {
      return listConstraints()
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
        const parsed = parseTrigger(r.definition)
        return {
          name: r.name,
          table: r.table,
          timing: parsed.timing,
          event: parsed.event,
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
    async listExtensions() {
      const result = await client.query<{ name: string; version: string }>(
        `SELECT extname AS name, extversion AS version FROM pg_extension ORDER BY extname`,
      )
      return result.rows.map<ExtensionInfo>(r => ({ name: r.name, version: r.version }))
    },
    async searchTables(pattern) {
      const result = await client.query<{ schema_name: string; table_name: string; kind: string }>(
        `SELECT n.nspname AS schema_name, c.relname AS table_name,
                CASE c.relkind
                  WHEN 'r' THEN 'table'
                  WHEN 'v' THEN 'view'
                  WHEN 'm' THEN 'materialized view'
                END AS kind
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm') AND c.relname ILIKE $1
         ORDER BY kind, c.relname
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<TableMatch>(r => ({
        schema: r.schema_name,
        name: r.table_name,
        kind: r.kind as TableMatch['kind'],
      }))
    },
    async databaseSize() {
      const result = await client.query<{ database: string; total: string }>(
        'SELECT current_database() AS database, pg_database_size(current_database())::bigint AS total',
      )
      const row = result.rows[0]
      return {
        database: row?.database ?? '',
        totalBytes: Number(row?.total ?? 0),
        dataBytes: null,
        indexBytes: null,
      } as DatabaseSize
    },
    async listTableSizes() {
      const result = await client.query<{
        schema_name: string
        table_name: string
        data: string
        index: string
        total: string
      }>(
        `SELECT n.nspname AS schema_name, c.relname AS table_name,
                pg_relation_size(c.oid) AS data, pg_indexes_size(c.oid) AS index,
                pg_total_relation_size(c.oid) AS total
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
         ORDER BY total DESC`,
      )
      return result.rows.map<TableSizeItem>(r => ({
        schema: r.schema_name,
        table: r.table_name,
        dataBytes: Number(r.data ?? 0),
        indexBytes: Number(r.index ?? 0),
        totalBytes: Number(r.total ?? 0),
      }))
    },
    async getTableComments(table) {
      const columns = await client.query<{ name: string; comment: string | null }>(
        `SELECT a.attname AS name, col_description(c.oid, a.attnum) AS comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
         WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY a.attnum`,
        [table],
      )
      if (columns.rows.length === 0) {
        throw new SqlError(`Table "${table}" not found in public schema.`, 'query')
      }
      const tables = await client.query<{ table_comment: string | null }>(
        `SELECT obj_description(c.oid, 'pg_class') AS table_comment
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'v', 'm')`,
        [table],
      )
      return {
        table,
        tableComment: tables.rows[0]?.table_comment ?? null,
        columns: columns.rows.map(r => ({ name: r.name, comment: r.comment })),
      } as TableCommentInfo
    },
    async listIncomingForeignKeys(table) {
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
           AND ccu.table_schema = 'public' AND ccu.table_name = $1
         ORDER BY tc.table_name, kcu.ordinal_position`,
        [table],
      )
      return result.rows.map<ForeignKeyInfo>(r => ({
        name: r.name,
        table: r.table,
        column: r.column,
        referencedTable: r.referenced_table,
        referencedColumn: r.referenced_column,
      }))
    },
    async getColumnStats(table, column) {
      assertSafeIdentifier(table, 'table name')
      assertSafeIdentifier(column, 'column name')
      const result = await client.query<{
        row_count: string
        non_null: string
        null_count: string
        distinct_count: string
      }>(
        `SELECT COUNT(*)::bigint AS row_count,
                COUNT("${column}")::bigint AS non_null,
                (COUNT(*) - COUNT("${column}"))::bigint AS null_count,
                COALESCE(COUNT(DISTINCT "${column}"), 0)::bigint AS distinct_count
         FROM "${table}"`,
      )
      const row = result.rows[0] ?? { row_count: '0', non_null: '0', null_count: '0', distinct_count: '0' }
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
      const result = await client.query<{
        name: string
        kind: string
        arguments: string
        language: string
        source: string
      }>(
        `SELECT p.proname AS name,
                CASE WHEN p.prokind = 'p' THEN 'procedure' ELSE 'function' END AS kind,
                pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language,
                pg_get_functiondef(p.oid) AS source
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_language l ON l.oid = p.prolang
         WHERE n.nspname = 'public' AND p.proname = $1 AND p.prokind IN ('f', 'p')
         ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`,
        [name],
      )
      if (result.rows.length === 0) {
        throw new SqlError(`Function "${name}" not found in public schema.`, 'query')
      }
      return result.rows.map<FunctionSourceInfo>(r => ({
        name: r.name,
        kind: r.kind as FunctionSourceInfo['kind'],
        arguments: r.arguments,
        language: r.language,
        source: r.source,
      }))
    },
    async listEnumTypes() {
      const result = await client.query<{ name: string; value: string; ord: string }>(
        `SELECT t.typname AS name, e.enumlabel AS value, e.enumsortorder::text AS ord
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
         ORDER BY t.typname, e.enumsortorder`,
      )
      const types = new Map<string, EnumTypeInfo>()
      for (const row of result.rows) {
        let info = types.get(row.name)
        if (!info) {
          info = { name: row.name, values: [] }
          types.set(row.name, info)
        }
        info.values.push(row.value)
      }
      return [...types.values()]
    },
    async getTableHealth(table) {
      const exists = await client.query<{ name: string }>(
        `SELECT c.relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
        [table],
      )
      if (exists.rows.length === 0) {
        throw new SqlError(`Table "${table}" not found in public schema.`, 'query')
      }
      const stats = await client.query<{
        table: string
        seq_scans: number | null
        index_scans: number | null
        live_rows: number | null
        dead_rows: number | null
        last_vacuum: string | null
        last_analyze: string | null
      }>(
        `SELECT c.relname AS table, s.seq_scan AS seq_scans, s.idx_scan AS index_scans,
                s.n_live_tup AS live_rows, s.n_dead_tup AS dead_rows,
                s.last_vacuum::text AS last_vacuum, s.last_analyze::text AS last_analyze
         FROM pg_stat_user_tables s
         JOIN pg_class c ON c.oid = s.relid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`,
        [table],
      )
      const row = stats.rows[0] ?? {}
      return {
        table,
        supported: true,
        seqScans: row.seq_scans === null || row.seq_scans === undefined ? null : Number(row.seq_scans),
        indexScans: row.index_scans === null || row.index_scans === undefined ? null : Number(row.index_scans),
        liveRows: row.live_rows === null || row.live_rows === undefined ? null : Number(row.live_rows),
        deadRows: row.dead_rows === null || row.dead_rows === undefined ? null : Number(row.dead_rows),
        lastVacuum: row.last_vacuum ?? null,
        lastAnalyze: row.last_analyze ?? null,
      } as TableHealth
    },
    async listActiveQueries() {
      const result = await client.query<{
        id: string
        user: string
        database: string | null
        state: string | null
        duration_seconds: string | null
        query: string | null
      }>(
        `SELECT pid::text AS id, usename AS user, datname AS database, state,
                EXTRACT(EPOCH FROM (now() - query_start))::int AS duration_seconds,
                query
         FROM pg_stat_activity
         WHERE state IS NOT NULL AND state <> 'idle' AND query NOT LIKE '%pg_stat_activity%'
         ORDER BY query_start`,
      )
      return result.rows.map<ActiveQueryInfo>(r => ({
        id: r.id,
        user: r.user,
        database: r.database,
        state: r.state,
        durationSeconds: r.duration_seconds === null || r.duration_seconds === undefined ? null : Number(r.duration_seconds),
        query: r.query ?? '',
      }))
    },
    async searchRoutines(pattern) {
      const result = await client.query<{
        name: string
        kind: string
        arguments: string
        language: string
      }>(
        `SELECT p.proname AS name,
                CASE WHEN p.prokind = 'p' THEN 'procedure' ELSE 'function' END AS kind,
                pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_language l ON l.oid = p.prolang
         WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p') AND p.proname ILIKE $1
         ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<RoutineMatchInfo>(r => ({
        name: r.name,
        kind: r.kind as RoutineMatchInfo['kind'],
        arguments: r.arguments,
        language: r.language,
      }))
    },
    async searchIndexes(pattern) {
      const result = await client.query<{
        schema_name: string
        table_name: string
        index_name: string
        column_name: string | null
        is_unique: boolean
        ord: number
      }>(
        `SELECT n.nspname AS schema_name, t.relname AS table_name, i.relname AS index_name,
                a.attname AS column_name, ix.indisunique AS is_unique, k.ord
         FROM pg_index ix
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN LATERAL unnest(ix.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord) ON TRUE
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
         WHERE n.nspname = 'public' AND (t.relname ILIKE $1 OR i.relname ILIKE $1)
         ORDER BY t.relname, i.relname, k.ord
         LIMIT 100`,
        [pattern],
      )
      const indexes = new Map<string, IndexMatchInfo>()
      for (const row of result.rows) {
        const key = `${row.table_name}.${row.index_name}`
        let info = indexes.get(key)
        if (!info) {
          info = {
            schema: row.schema_name,
            table: row.table_name,
            name: row.index_name,
            columns: [],
            unique: row.is_unique,
          }
          indexes.set(key, info)
        }
        if (row.column_name) info.columns.push(row.column_name)
      }
      return [...indexes.values()]
    },
    async listIndexUsage() {
      const result = await client.query<{
        schema_name: string
        table_name: string
        index_name: string
        scans: string
        tuples_read: string
        tuples_fetched: string
      }>(
        `SELECT n.nspname AS schema_name, t.relname AS table_name, i.relname AS index_name,
                COALESCE(s.idx_scan, 0) AS scans,
                COALESCE(s.idx_tup_read, 0) AS tuples_read,
                COALESCE(s.idx_tup_fetch, 0) AS tuples_fetched
         FROM pg_class i
         JOIN pg_index ix ON ix.indexrelid = i.oid
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
         WHERE n.nspname = 'public' AND i.relkind = 'i'
         ORDER BY COALESCE(s.idx_scan, 0) DESC, t.relname, i.relname
         LIMIT 200`,
      )
      return result.rows.map<IndexUsageInfo>(r => ({
        schema: r.schema_name,
        table: r.table_name,
        index: r.index_name,
        scans: Number(r.scans ?? 0),
        tuplesRead: Number(r.tuples_read ?? 0),
        tuplesFetched: Number(r.tuples_fetched ?? 0),
      }))
    },
    async listLocks() {
      const result = await client.query<{
        pid: string
        user: string | null
        database: string | null
        state: string | null
        object: string | null
        lock_type: string
        mode: string
        granted: boolean
        query: string | null
      }>(
        `SELECT a.pid::text AS pid, a.usename AS user, a.datname AS database, a.state,
                COALESCE(c.relname, d.datname, l.object::text) AS object,
                l.locktype AS lock_type, l.mode AS lock_mode, l.granted,
                a.query
         FROM pg_locks l
         LEFT JOIN pg_class c ON c.oid = l.relation
         LEFT JOIN pg_database d ON d.oid = l.database
         LEFT JOIN pg_stat_activity a ON a.pid = l.pid
         WHERE a.pid IS NOT NULL
         ORDER BY l.pid, l.locktype, l.mode
         LIMIT 200`,
      )
      return result.rows.map<LockInfo>(r => ({
        pid: r.pid,
        user: r.user,
        database: r.database,
        state: r.state,
        object: r.object,
        lockType: r.lock_type,
        mode: r.mode,
        granted: r.granted,
        query: r.query,
      }))
    },
    async getTableLastAccess(table) {
      const exists = await client.query<{ name: string }>(
        `SELECT c.relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
        [table],
      )
      if (exists.rows.length === 0) {
        throw new SqlError(`Table "${table}" not found in public schema.`, 'query')
      }
      const stats = await client.query<{
        last_seq_scan: string | null
        last_idx_scan: string | null
        seq_scan: number | null
        idx_scan: number | null
      }>(
        `SELECT s.last_seq_scan::text AS last_seq_scan, s.last_idx_scan::text AS last_idx_scan,
                s.seq_scan AS seq_scan, s.idx_scan AS idx_scan
         FROM pg_stat_user_tables s
         JOIN pg_class c ON c.oid = s.relid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`,
        [table],
      )
      const row = stats.rows[0] ?? {}
      return {
        table,
        supported: true,
        lastSeqScan: row.last_seq_scan ?? null,
        lastIdxScan: row.last_idx_scan ?? null,
        seqScans: row.seq_scan === null || row.seq_scan === undefined ? null : Number(row.seq_scan),
        indexScans: row.idx_scan === null || row.idx_scan === undefined ? null : Number(row.idx_scan),
      } as TableAccessInfo
    },
    async searchViewDefinitions(pattern) {
      const result = await client.query<{
        schema_name: string
        name: string
        definition: string | null
      }>(
        `SELECT schemaname AS schema_name, viewname AS name, definition
         FROM pg_views
         WHERE schemaname = 'public' AND (viewname ILIKE $1 OR definition ILIKE $1)
         ORDER BY viewname
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<ViewDefinitionMatchInfo>(r => ({
        schema: r.schema_name,
        name: r.name,
        definition: r.definition,
      }))
    },
    async searchRoutineDefinitions(pattern) {
      const result = await client.query<{
        schema_name: string
        name: string
        kind: string
        arguments: string
        language: string
        source: string
      }>(
        `SELECT n.nspname AS schema_name, p.proname AS name,
                CASE WHEN p.prokind = 'p' THEN 'procedure' ELSE 'function' END AS kind,
                pg_get_function_identity_arguments(p.oid) AS arguments,
                l.lanname AS language,
                pg_get_functiondef(p.oid) AS source
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_language l ON l.oid = p.prolang
         WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
           AND (p.proname ILIKE $1 OR p.prosrc ILIKE $1)
         ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<RoutineDefinitionMatchInfo>(r => ({
        schema: r.schema_name,
        name: r.name,
        kind: r.kind as RoutineDefinitionMatchInfo['kind'],
        arguments: r.arguments,
        language: r.language,
        source: r.source ?? null,
      }))
    },
    async searchTriggerDefinitions(pattern) {
      const result = await client.query<{
        schema_name: string
        table_name: string
        name: string
        definition: string
      }>(
        `SELECT n.nspname AS schema_name, c.relname AS table_name,
                t.tgname AS name, pg_get_triggerdef(t.oid) AS definition
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal
           AND (t.tgname ILIKE $1 OR pg_get_triggerdef(t.oid) ILIKE $1)
         ORDER BY c.relname, t.tgname
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<TriggerDefinitionMatchInfo>(r => {
        const parsed = parseTrigger(r.definition)
        return {
          schema: r.schema_name,
          table: r.table_name,
          name: r.name,
          timing: parsed.timing,
          event: parsed.event,
          definition: r.definition ?? null,
        }
      })
    },
    async searchConstraintDefinitions(pattern) {
      const result = await client.query<{
        schema_name: string
        table_name: string
        name: string
        type: string
        definition: string
      }>(
        `SELECT n.nspname AS schema_name, c.relname AS table_name,
                con.conname AS name,
                CASE con.contype
                  WHEN 'p' THEN 'PRIMARY KEY'
                  WHEN 'u' THEN 'UNIQUE'
                  WHEN 'c' THEN 'CHECK'
                END AS type,
                pg_get_constraintdef(con.oid) AS definition
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'c') AND con.conrelid <> 0
           AND (con.conname ILIKE $1 OR pg_get_constraintdef(con.oid) ILIKE $1)
         ORDER BY c.relname, con.conname
         LIMIT 100`,
        [pattern],
      )
      return result.rows.map<ConstraintDefinitionMatchInfo>(r => ({
        schema: r.schema_name,
        table: r.table_name,
        name: r.name,
        type: r.type as ConstraintDefinitionMatchInfo['type'],
        definition: r.definition ?? null,
        simplified: false,
      }))
    },
    async searchTableDefinitions(pattern) {
      const result = await client.query<{ table_name: string }>(
        `SELECT tablename AS table_name
         FROM pg_tables
         WHERE schemaname = 'public' AND tablename ILIKE $1
         ORDER BY tablename
         LIMIT 100`,
        [pattern],
      )
      const matches: TableDefinitionMatchInfo[] = []
      for (const row of result.rows) {
        const schema = await createSchema(row.table_name)
        matches.push({ schema: 'public', table: row.table_name, definition: schema.ddl, simplified: true })
      }
      return matches
    },
    async close() {
      await client.end()
    },
  }
}
