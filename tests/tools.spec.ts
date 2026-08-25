import { describe, expect, it, vi } from 'vitest'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { DbClient, SqlError } from '../src/client.ts'
import type { Driver } from '../src/client.ts'
import { createTools } from '../src/index.ts'

function exec(): ToolRunContext {
  return { signal: new AbortController().signal } as unknown as ToolRunContext
}

function makeClient(driver: Driver) {
  return new DbClient({
    type: 'postgres',
    host: 'localhost',
    user: 'u',
    password: 'p',
    database: 'db',
  }, driver)
}

function mockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    query: vi.fn(async () => ({ columns: ['id', 'name'], rows: [{ id: 1, name: 'a' }] })),
    listTables: vi.fn(async () => ['users']),
    describeTable: vi.fn(async () => [{ name: 'id', type: 'integer', nullable: false, defaultValue: null }]),
    listIndexes: vi.fn(async () => [{ name: 'users_pkey', columns: ['id'], unique: true }]),
    databaseInfo: vi.fn(async () => ({ version: 'PostgreSQL 16', database: 'db', user: 'u', serverTime: '2026-08-14T00:00:00Z' })),
    tableStats: vi.fn(async () => [{ table: 'users', schema: 'public', estimatedRows: 100 }]),
    searchColumns: vi.fn(async () => [{ table: 'users', column: 'user_id', type: 'integer' }]),
    listViews: vi.fn(async () => [{ name: 'active_users', definition: 'SELECT * FROM users WHERE active' }]),
    tableSize: vi.fn(async () => ({ table: 'users', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 })),
    getSchema: vi.fn(async () => ({ table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true })),
    previewTable: vi.fn(async () => ({ columns: ['id'], rows: [{ id: 1 }] })),
    listFunctions: vi.fn(async () => [{ name: 'add', arguments: 'a int, b int', language: 'sql', returnType: 'integer' }]),
    listTriggers: vi.fn(async () => [{ name: 'trg', table: 'users', timing: 'AFTER', event: 'INSERT', definition: 'CREATE TRIGGER ...' }]),
    listForeignKeys: vi.fn(async () => [{ name: 'fk', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }]),
    schemaDump: vi.fn(async () => ({
      tables: [{ table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true }],
      views: [{ name: 'active_users', definition: 'SELECT * FROM users' }],
    })),
    listExtensions: vi.fn(async () => [{ name: 'pg_trgm', version: '1.6' }]),
    listSchemas: vi.fn(async () => ['public', 'audit']),
    listSequences: vi.fn(async () => [{ name: 'users_id_seq', dataType: 'integer', startValue: '1', increment: '1' }]),
    listConstraints: vi.fn(async () => [
      { name: 'users_pkey', table: 'users', type: 'PRIMARY KEY', columns: ['id'], definition: 'PRIMARY KEY (id)' },
      { name: 'users_age_check', table: 'users', type: 'CHECK', columns: [], definition: 'CHECK ((age >= 0))' },
    ]),
    listDatabases: vi.fn(async () => [{ name: 'app' }, { name: 'audit' }]),
    listRoles: vi.fn(async () => [{ name: 'readonly', roleType: 'role', attributes: ['can login'], detail: 'no connection limit' }]),
    listGrants: vi.fn(async () => [{ grantee: 'app_user', object: 'public.users', privilege: 'SELECT', grantable: false }]),
    listMaterializedViews: vi.fn(async () => [{ name: 'daily_sales', definition: 'SELECT * FROM sales WHERE day = CURRENT_DATE' }]),
    listPartitions: vi.fn(async () => [{ parent: 'orders', partition: 'orders_2026', method: 'RANGE', bound: 'FOR VALUES FROM (\'2026-01-01\') TO (\'2027-01-01\')', estimatedRows: 100 }]),
    getTableRowCount: vi.fn(async () => ({ table: 'users', rowCount: 42 })),
    searchTables: vi.fn(async () => [
      { schema: 'public', name: 'order_items', kind: 'table' },
      { schema: 'public', name: 'order_summary', kind: 'view' },
    ]),
    databaseSize: vi.fn(async () => ({ database: 'db', totalBytes: 4096, dataBytes: 1024, indexBytes: 3072 })),
    listTableSizes: vi.fn(async () => [{ schema: 'public', table: 'orders', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 }]),
    getTableComments: vi.fn(async () => ({
      table: 'users',
      tableComment: 'accounts',
      columns: [{ name: 'id', comment: 'primary key' }, { name: 'email', comment: null }],
    })),
    listIncomingForeignKeys: vi.fn(async () => [
      { name: 'orders_user_id_fkey', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
    ]),
    close: vi.fn(async () => {}),
    ...overrides,
  }
}

const tools = () => Object.fromEntries(createTools(makeClient(mockDriver())).map(t => [t.name, t]))

describe('tool definitions', () => {
  it('registers the planned tools', () => {
    expect(Object.keys(tools()).sort()).toEqual([
      'sql_database_info',
      'sql_database_size',
      'sql_describe_table',
      'sql_explain',
      'sql_get_schema',
      'sql_get_table_comments',
      'sql_get_table_row_count',
      'sql_list_constraints',
      'sql_list_databases',
      'sql_list_extensions',
      'sql_list_foreign_keys',
      'sql_list_functions',
      'sql_list_grants',
      'sql_list_incoming_foreign_keys',
      'sql_list_indexes',
      'sql_list_materialized_views',
      'sql_list_partitions',
      'sql_list_roles',
      'sql_list_schemas',
      'sql_list_sequences',
      'sql_list_table_sizes',
      'sql_list_tables',
      'sql_list_triggers',
      'sql_list_views',
      'sql_ping',
      'sql_preview',
      'sql_query',
      'sql_schema_dump',
      'sql_search_columns',
      'sql_search_tables',
      'sql_table_size',
      'sql_table_stats',
    ])
  })

  it('sql_query returns rows and maps read-only output', async () => {
    const tool = tools()['sql_query']
    const result = await tool.execute({ sql: 'SELECT * FROM users' }, exec())
    expect(result).toEqual({
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'a' }],
      rowCount: 1,
      truncated: false,
    })
  })

  it('sql_query surfaces SqlError as isError', async () => {
    const driver = mockDriver({ query: vi.fn(async () => { throw new SqlError('not allowed', 'denied') }) })
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_query')!
    await expect(tool.execute({ sql: 'SELECT 1' }, exec())).rejects.toMatchObject({ kind: 'denied' })
  })

  it('sql_query render formats a table and truncation notice', async () => {
    const tool = tools()['sql_query']
    const render = (tool.output as { render: (a: unknown, v: any) => unknown }).render
    const blocks = render({}, {
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'a' }],
      rowCount: 2,
      truncated: true,
    })
    const text = JSON.stringify(blocks)
    expect(text).toContain('id\\tname')
    expect(text).toContain('truncated: showing 1 of 2 rows')
  })

  it('sql_list_tables returns tables and renders them', async () => {
    const tool = tools()['sql_list_tables']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ tables: ['users'] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, { tables: ['users', 'orders'] })
    expect(JSON.stringify(blocks)).toContain('orders')
  })

  it('sql_describe_table returns column info', async () => {
    const tool = tools()['sql_describe_table']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({
      table: 'users',
      columns: [{ name: 'id', type: 'integer', nullable: false, defaultValue: null }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users',
      columns: [{ name: 'id', type: 'integer', nullable: false, defaultValue: null }],
    })
    expect(JSON.stringify(blocks)).toContain('id\\tinteger\\tNO')
  })

  it('validates required parameters', async () => {
    const tool = tools()['sql_query']
    await expect(tool.execute({} as never, exec())).rejects.toThrow()
    const describe = tools()['sql_describe_table']
    await expect(describe.execute({} as never, exec())).rejects.toThrow()
    const explain = tools()['sql_explain']
    await expect(explain.execute({} as never, exec())).rejects.toThrow()
    const indexes = tools()['sql_list_indexes']
    await expect(indexes.execute({} as never, exec())).rejects.toThrow()
    const search = tools()['sql_search_columns']
    await expect(search.execute({} as never, exec())).rejects.toThrow()
    const size = tools()['sql_table_size']
    await expect(size.execute({} as never, exec())).rejects.toThrow()
    const schema = tools()['sql_get_schema']
    await expect(schema.execute({} as never, exec())).rejects.toThrow()
    const preview = tools()['sql_preview']
    await expect(preview.execute({} as never, exec())).rejects.toThrow()
    const rowCount = tools()['sql_get_table_row_count']
    await expect(rowCount.execute({} as never, exec())).rejects.toThrow()
    const tableSearch = tools()['sql_search_tables']
    await expect(tableSearch.execute({} as never, exec())).rejects.toThrow()
    const comments = tools()['sql_get_table_comments']
    await expect(comments.execute({} as never, exec())).rejects.toThrow()
    const incoming = tools()['sql_list_incoming_foreign_keys']
    await expect(incoming.execute({} as never, exec())).rejects.toThrow()
  })

  it('sql_explain prefixes EXPLAIN when missing and passes read-only check', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_explain')!
    const result = await tool.execute({ sql: 'SELECT * FROM users' }, exec())
    expect(result).toMatchObject({ rowCount: 1 })
    expect(driver.query).toHaveBeenCalledWith('EXPLAIN SELECT * FROM users', expect.anything())
  })

  it('sql_explain does not double-prefix EXPLAIN', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_explain')!
    await tool.execute({ sql: 'EXPLAIN SELECT 1' }, exec())
    expect(driver.query).toHaveBeenCalledWith('EXPLAIN SELECT 1', expect.anything())
  })

  it('sql_explain rejects write statements through the read-only check', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_explain')!
    await expect(tool.execute({ sql: 'DELETE FROM users' }, exec())).rejects.toMatchObject({ kind: 'denied' })
    expect(driver.query).not.toHaveBeenCalled()
  })

  it('sql_list_indexes returns indexes and renders them', async () => {
    const tool = tools()['sql_list_indexes']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({ table: 'users', indexes: [{ name: 'users_pkey', columns: ['id'], unique: true }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users',
      indexes: [{ name: 'users_pkey', columns: ['id'], unique: true }],
    })
    expect(JSON.stringify(blocks)).toContain('users_pkey')
    expect(JSON.stringify(blocks)).toContain('YES')
  })

  it('sql_database_info returns and renders server info', async () => {
    const tool = tools()['sql_database_info']
    const result = await tool.execute({}, exec())
    expect(result).toMatchObject({ database: 'db', user: 'u' })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      version: 'PostgreSQL 16', database: 'db', user: 'u', serverTime: '2026-08-14T00:00:00Z',
    })
    expect(JSON.stringify(blocks)).toContain('PostgreSQL 16')
  })

  it('sql_table_stats returns estimated rows and renders them', async () => {
    const tool = tools()['sql_table_stats']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ stats: [{ table: 'users', schema: 'public', estimatedRows: 100 }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      stats: [{ table: 'users', schema: 'public', estimatedRows: 100 }],
    })
    expect(JSON.stringify(blocks)).toContain('users')
  })

  it('sql_search_columns returns matches and renders them', async () => {
    const tool = tools()['sql_search_columns']
    const result = await tool.execute({ pattern: 'user' }, exec())
    expect(result).toEqual({ matches: [{ table: 'users', column: 'user_id', type: 'integer' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ pattern: 'user' }, {
      matches: [{ table: 'users', column: 'user_id', type: 'integer' }],
    })
    expect(JSON.stringify(blocks)).toContain('users.user_id')
  })

  it('sql_ping returns ok and renders latency', async () => {
    const tool = tools()['sql_ping']
    const result = await tool.execute({}, exec())
    expect(result).toMatchObject({ ok: true })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, { ok: true, latencyMs: 42 })
    expect(JSON.stringify(blocks)).toContain('42 ms')
  })

  it('sql_list_views returns views and renders definitions', async () => {
    const tool = tools()['sql_list_views']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ views: [{ name: 'active_users', definition: 'SELECT * FROM users WHERE active' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      views: [{ name: 'active_users', definition: 'SELECT * FROM users WHERE active' }],
    })
    expect(JSON.stringify(blocks)).toContain('active_users: SELECT * FROM users WHERE active')
  })

  it('sql_table_size returns sizes and renders human-readable units', async () => {
    const tool = tools()['sql_table_size']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({ table: 'users', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users', dataBytes: 1536, indexBytes: 1024, totalBytes: 2560,
    })
    expect(JSON.stringify(blocks)).toContain('KiB')
  })

  it('sql_get_schema returns DDL and renders it', async () => {
    const tool = tools()['sql_get_schema']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({ table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true,
    })
    expect(JSON.stringify(blocks)).toContain('CREATE TABLE users')
  })

  it('sql_preview returns rows and clamps limit to 1-100', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_preview')!
    const result = await tool.execute({ table: 'users', limit: 999 }, exec())
    expect(driver.previewTable).toHaveBeenCalledWith('users', 100, expect.anything())
    expect(result).toMatchObject({ table: 'users', limit: 100, rowCount: 1 })
    const result2 = await tool.execute({ table: 'users' }, exec())
    expect(result2).toMatchObject({ limit: 10 })
  })

  it('sql_preview render formats rows', async () => {
    const tool = tools()['sql_preview']
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users', limit: 10, columns: ['id'], rows: [{ id: 1 }], rowCount: 1, truncated: false,
    })
    expect(JSON.stringify(blocks)).toContain('id')
    expect(JSON.stringify(blocks)).toContain('1')
  })

  it('sql_list_functions returns and renders functions', async () => {
    const tool = tools()['sql_list_functions']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ functions: [{ name: 'add', arguments: 'a int, b int', language: 'sql', returnType: 'integer' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      functions: [{ name: 'add', arguments: 'a int, b int', language: 'sql', returnType: 'integer' }],
    })
    expect(JSON.stringify(blocks)).toContain('add')
  })

  it('sql_list_triggers returns and renders triggers', async () => {
    const tool = tools()['sql_list_triggers']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ triggers: [{ name: 'trg', table: 'users', timing: 'AFTER', event: 'INSERT', definition: 'CREATE TRIGGER ...' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      triggers: [{ name: 'trg', table: 'users', timing: 'AFTER', event: 'INSERT' }],
    })
    expect(JSON.stringify(blocks)).toContain('AFTER')
  })

  it('sql_list_foreign_keys returns and renders foreign keys', async () => {
    const tool = tools()['sql_list_foreign_keys']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ foreignKeys: [{ name: 'fk', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      foreignKeys: [{ name: 'fk', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
    })
    expect(JSON.stringify(blocks)).toContain('orders.user_id')
    expect(JSON.stringify(blocks)).toContain('users.id')
  })

  it('sql_schema_dump returns and renders the dump', async () => {
    const tool = tools()['sql_schema_dump']
    const result = await tool.execute({}, exec())
    expect(result).toMatchObject({ tables: [{ table: 'users' }], views: [{ name: 'active_users' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      tables: [{ table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true }],
      views: [{ name: 'active_users', definition: 'SELECT * FROM users' }],
    })
    const text = JSON.stringify(blocks)
    expect(text).toContain('CREATE TABLE users')
    expect(text).toContain('CREATE VIEW active_users')
  })

  it('sql_query passes an explicit limit to the client', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_query')!
    await tool.execute({ sql: 'SELECT * FROM users', limit: 5 }, exec())
    expect(driver.query).toHaveBeenCalled()
  })

  it('sql_query clamps limit to 1-1000', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const tool = createTools(client).find(t => t.name === 'sql_query')!
    await tool.execute({ sql: 'SELECT * FROM users', limit: 99999 }, exec())
    expect(driver.query).toHaveBeenCalledWith('SELECT * FROM users', expect.anything())
  })

  it('sql_list_schemas returns schemas and renders them', async () => {
    const tool = tools()['sql_list_schemas']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ schemas: ['public', 'audit'] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, { schemas: ['public', 'audit'] })
    expect(JSON.stringify(blocks)).toContain('audit')
  })

  it('sql_list_sequences returns supported:true on postgres and renders sequence info', async () => {
    const tool = tools()['sql_list_sequences']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      supported: true,
      sequences: [{ name: 'users_id_seq', dataType: 'integer', startValue: '1', increment: '1' }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      supported: true,
      sequences: [{ name: 'users_id_seq', dataType: 'integer', startValue: '1', increment: '1' }],
    })
    expect(JSON.stringify(blocks)).toContain('users_id_seq')
  })

  it('sql_list_sequences reports not supported on mysql', async () => {
    const client = new DbClient({
      type: 'mysql', host: 'localhost', user: 'u', password: 'p', database: 'db',
    }, mockDriver())
    const tool = createTools(client).find(t => t.name === 'sql_list_sequences')!
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ supported: false, sequences: [] })
  })

  it('sql_list_constraints returns constraints and renders them', async () => {
    const tool = tools()['sql_list_constraints']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      constraints: [
        { name: 'users_pkey', table: 'users', type: 'PRIMARY KEY', columns: ['id'], definition: 'PRIMARY KEY (id)' },
        { name: 'users_age_check', table: 'users', type: 'CHECK', columns: [], definition: 'CHECK ((age >= 0))' },
      ],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      constraints: [{ name: 'users_pkey', table: 'users', type: 'PRIMARY KEY', columns: ['id'] }],
    })
    expect(JSON.stringify(blocks)).toContain('PRIMARY KEY')
  })

  it('sql_list_extensions returns supported:true and extensions on postgres', async () => {
    const client = makeClient(mockDriver())
    const tool = createTools(client).find(t => t.name === 'sql_list_extensions')!
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ supported: true, extensions: [{ name: 'pg_trgm', version: '1.6' }] })
  })

  it('sql_list_extensions reports not supported on mysql', async () => {
    const client = new DbClient({
      type: 'mysql', host: 'localhost', user: 'u', password: 'p', database: 'db',
    }, mockDriver())
    const tool = createTools(client).find(t => t.name === 'sql_list_extensions')!
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ supported: false, extensions: [] })
  })

  it('sql_list_databases returns and renders visible databases', async () => {
    const tool = tools()['sql_list_databases']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ databases: [{ name: 'app' }, { name: 'audit' }] })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, { databases: [{ name: 'app' }] })
    expect(JSON.stringify(blocks)).toContain('app')
  })

  it('sql_list_roles returns and renders roles', async () => {
    const tool = tools()['sql_list_roles']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      roles: [{ name: 'readonly', roleType: 'role', attributes: ['can login'], detail: 'no connection limit' }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      roles: [{ name: 'readonly', roleType: 'role', attributes: ['can login'], detail: 'no connection limit' }],
    })
    expect(JSON.stringify(blocks)).toContain('readonly')
    expect(JSON.stringify(blocks)).toContain('can login')
  })

  it('sql_list_grants returns and renders grants', async () => {
    const tool = tools()['sql_list_grants']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      grants: [{ grantee: 'app_user', object: 'public.users', privilege: 'SELECT', grantable: false }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      grants: [{ grantee: 'app_user', object: 'public.users', privilege: 'SELECT', grantable: true }],
    })
    expect(JSON.stringify(blocks)).toContain('app_user')
    expect(JSON.stringify(blocks)).toContain('YES')
  })

  it('sql_list_materialized_views returns supported:true on postgres', async () => {
    const tool = tools()['sql_list_materialized_views']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      supported: true,
      materializedViews: [{ name: 'daily_sales', definition: 'SELECT * FROM sales WHERE day = CURRENT_DATE' }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      supported: true,
      materializedViews: [{ name: 'daily_sales', definition: 'SELECT * FROM sales' }],
    })
    expect(JSON.stringify(blocks)).toContain('daily_sales')
  })

  it('sql_list_materialized_views reports not supported on mysql', async () => {
    const client = new DbClient({
      type: 'mysql', host: 'localhost', user: 'u', password: 'p', database: 'db',
    }, mockDriver())
    const tool = createTools(client).find(t => t.name === 'sql_list_materialized_views')!
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ supported: false, materializedViews: [] })
  })

  it('sql_list_partitions returns and renders partitions', async () => {
    const tool = tools()['sql_list_partitions']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      partitions: [{ parent: 'orders', partition: 'orders_2026', method: 'RANGE', bound: 'FOR VALUES FROM (\'2026-01-01\') TO (\'2027-01-01\')', estimatedRows: 100 }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      partitions: [{ parent: 'orders', partition: 'orders_2026', method: 'RANGE', bound: 'FOR VALUES FROM ...', estimatedRows: 100 }],
    })
    expect(JSON.stringify(blocks)).toContain('orders')
  })

  it('sql_get_table_row_count returns and renders an exact count', async () => {
    const tool = tools()['sql_get_table_row_count']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({ table: 'users', rowCount: 42 })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users', rowCount: 42,
    })
    expect(JSON.stringify(blocks)).toContain('42')
  })

  it('sql_search_tables returns matches and renders them', async () => {
    const tool = tools()['sql_search_tables']
    const result = await tool.execute({ pattern: 'order' }, exec())
    expect(result).toEqual({
      matches: [
        { schema: 'public', name: 'order_items', kind: 'table' },
        { schema: 'public', name: 'order_summary', kind: 'view' },
      ],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ pattern: 'order' }, {
      matches: [{ schema: 'public', name: 'order_items', kind: 'table' }],
    })
    expect(JSON.stringify(blocks)).toContain('order_items')
    expect(JSON.stringify(blocks)).toContain('table')
  })

  it('sql_database_size returns and renders size', async () => {
    const tool = tools()['sql_database_size']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({ database: 'db', totalBytes: 4096, dataBytes: 1024, indexBytes: 3072 })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      database: 'db', totalBytes: 4096, dataBytes: 1024, indexBytes: 3072,
    })
    const text = JSON.stringify(blocks)
    expect(text).toContain('db')
    expect(text).toContain('KiB')
  })

  it('sql_list_table_sizes returns and renders table sizes', async () => {
    const tool = tools()['sql_list_table_sizes']
    const result = await tool.execute({}, exec())
    expect(result).toEqual({
      sizes: [{ schema: 'public', table: 'orders', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({}, {
      sizes: [{ schema: 'public', table: 'orders', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 }],
    })
    expect(JSON.stringify(blocks)).toContain('orders')
    expect(JSON.stringify(blocks)).toContain('KiB')
  })

  it('sql_get_table_comments returns and renders comments', async () => {
    const tool = tools()['sql_get_table_comments']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({
      table: 'users',
      tableComment: 'accounts',
      columns: [{ name: 'id', comment: 'primary key' }, { name: 'email', comment: null }],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users',
      tableComment: 'accounts',
      columns: [{ name: 'id', comment: 'primary key' }],
    })
    const text = JSON.stringify(blocks)
    expect(text).toContain('accounts')
    expect(text).toContain('primary key')
  })

  it('sql_list_incoming_foreign_keys returns and renders references', async () => {
    const tool = tools()['sql_list_incoming_foreign_keys']
    const result = await tool.execute({ table: 'users' }, exec())
    expect(result).toEqual({
      table: 'users',
      foreignKeys: [
        { name: 'orders_user_id_fkey', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
      ],
    })
    const blocks = (tool.output as { render: (a: unknown, v: any) => unknown }).render({ table: 'users' }, {
      table: 'users',
      foreignKeys: [{ name: 'orders_user_id_fkey', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
    })
    const text = JSON.stringify(blocks)
    expect(text).toContain('orders.user_id')
    expect(text).toContain('users.id')
  })
})

describe('tool presentation (pure render intents)', () => {
  const defs = () => Object.fromEntries(createTools(makeClient(mockDriver())).map(t => [t.name, t]))

  it('sql_query pending and result cards', () => {
    const t = defs()['sql_query'] as any
    const args = { sql: 'SELECT 1' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read' })
    const res = t.presentResult(args, { columns: ['id'], rowCount: 3 })
    expect(res).toMatchObject({ card: 'generic', title: '3 rows' })
    const truncated = t.presentResult(args, { columns: ['id'], rowCount: 50, truncated: true })
    expect(truncated).toMatchObject({ title: '50 rows (truncated)' })
  })

  it('sql_list_tables pending and result cards', () => {
    const t = defs()['sql_list_tables'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read' })
    expect(t.presentResult({}, { tables: ['a', 'b'] })).toMatchObject({ title: '2 tables' })
  })

  it('sql_describe_table pending and result cards', () => {
    const t = defs()['sql_describe_table'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Describe table users' })
    expect(t.presentResult(args, { table: 'users', columns: [{ name: 'id', type: 'integer' }] })).toMatchObject({
      card: 'generic',
      title: 'Table users',
    })
  })

  it('sql_explain pending and result cards', () => {
    const t = defs()['sql_explain'] as any
    expect(t.presentCall({ sql: 'SELECT 1' })).toMatchObject({ card: 'generic', kind: 'read' })
    expect(t.presentResult({ sql: 'SELECT 1' }, { columns: ['QUERY PLAN'], rowCount: 2 })).toMatchObject({ title: 'Plan: 2 row(s)' })
  })

  it('sql_list_indexes pending and result cards', () => {
    const t = defs()['sql_list_indexes'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'List indexes of users' })
    expect(t.presentResult(args, { table: 'users', indexes: [{ name: 'a' }] })).toMatchObject({ title: 'Indexes: users' })
  })

  it('sql_database_info pending and result cards', () => {
    const t = defs()['sql_database_info'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'Database info' })
    expect(t.presentResult({}, { database: 'db', version: 'PG 16' })).toMatchObject({ title: 'Database db' })
  })

  it('sql_table_stats pending and result cards', () => {
    const t = defs()['sql_table_stats'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'Table stats' })
    expect(t.presentResult({}, { stats: [{}, {}] })).toMatchObject({ title: '2 table(s)' })
  })

  it('sql_search_columns pending and result cards', () => {
    const t = defs()['sql_search_columns'] as any
    const args = { pattern: 'user' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'search', title: 'Search columns: user' })
    expect(t.presentResult(args, { matches: [{ table: 't', column: 'c' }] })).toMatchObject({ title: '1 column(s)' })
  })

  it('sql_ping pending and result cards', () => {
    const t = defs()['sql_ping'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'Ping database' })
    expect(t.presentResult({}, { ok: true, latencyMs: 12 })).toMatchObject({ title: 'OK (12 ms)' })
    expect(t.presentResult({}, { ok: false })).toMatchObject({ title: 'Failed' })
  })

  it('sql_list_views pending and result cards', () => {
    const t = defs()['sql_list_views'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List views' })
    expect(t.presentResult({}, { views: [{}, {}] })).toMatchObject({ title: '2 view(s)' })
  })

  it('sql_list_schemas pending and result cards', () => {
    const t = defs()['sql_list_schemas'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List schemas' })
    expect(t.presentResult({}, { schemas: ['public', 'audit'] })).toMatchObject({ title: '2 schema(s)' })
  })

  it('sql_list_sequences pending and result cards', () => {
    const t = defs()['sql_list_sequences'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List sequences' })
    expect(t.presentResult({}, { supported: true, sequences: [{}] })).toMatchObject({ title: '1 sequence(s)' })
    expect(t.presentResult({}, { supported: false, sequences: [] })).toMatchObject({ title: 'Not supported' })
  })

  it('sql_list_constraints pending and result cards', () => {
    const t = defs()['sql_list_constraints'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List constraints' })
    expect(t.presentResult({}, { constraints: [{}, {}] })).toMatchObject({ title: '2 constraint(s)' })
  })

  it('sql_list_databases pending and result cards', () => {
    const t = defs()['sql_list_databases'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'search', title: 'List databases' })
    expect(t.presentResult({}, { databases: [{}, {}] })).toMatchObject({ title: '2 database(s)' })
  })

  it('sql_list_roles pending and result cards', () => {
    const t = defs()['sql_list_roles'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'search', title: 'List roles' })
    expect(t.presentResult({}, { roles: [{}] })).toMatchObject({ title: '1 role(s)' })
  })

  it('sql_list_grants pending and result cards', () => {
    const t = defs()['sql_list_grants'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'search', title: 'List grants' })
    expect(t.presentResult({}, { grants: [{}, {}] })).toMatchObject({ title: '2 grant(s)' })
  })

  it('sql_list_materialized_views pending and result cards', () => {
    const t = defs()['sql_list_materialized_views'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List materialized views' })
    expect(t.presentResult({}, { supported: true, materializedViews: [{}] })).toMatchObject({ title: '1 materialized view(s)' })
    expect(t.presentResult({}, { supported: false, materializedViews: [] })).toMatchObject({ title: 'Not supported' })
  })

  it('sql_list_partitions pending and result cards', () => {
    const t = defs()['sql_list_partitions'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List partitions' })
    expect(t.presentResult({}, { partitions: [{}, {}] })).toMatchObject({ title: '2 partition(s)' })
  })

  it('sql_get_table_row_count pending and result cards', () => {
    const t = defs()['sql_get_table_row_count'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Row count: users' })
    expect(t.presentResult(args, { table: 'users', rowCount: 42 })).toMatchObject({ title: 'users: 42 row(s)' })
  })

  it('sql_table_size pending and result cards', () => {
    const t = defs()['sql_table_size'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Size of users' })
    expect(t.presentResult(args, { table: 'users', totalBytes: 2560 })).toMatchObject({ title: 'Size: users' })
  })

  it('sql_get_schema pending and result cards', () => {
    const t = defs()['sql_get_schema'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Schema of users' })
    expect(t.presentResult(args, { table: 'users', simplified: true })).toMatchObject({ title: 'Schema: users (simplified)' })
    expect(t.presentResult(args, { table: 'users', simplified: false })).toMatchObject({ title: 'Schema: users' })
  })

  it('sql_preview pending and result cards', () => {
    const t = defs()['sql_preview'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Preview users' })
    expect(t.presentResult(args, { table: 'users', rowCount: 10 })).toMatchObject({ title: 'Preview: users' })
  })

  it('sql_list_functions pending and result cards', () => {
    const t = defs()['sql_list_functions'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List functions' })
    expect(t.presentResult({}, { functions: [{}, {}] })).toMatchObject({ title: '2 function(s)' })
  })

  it('sql_list_triggers pending and result cards', () => {
    const t = defs()['sql_list_triggers'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List triggers' })
    expect(t.presentResult({}, { triggers: [{}] })).toMatchObject({ title: '1 trigger(s)' })
  })

  it('sql_list_foreign_keys pending and result cards', () => {
    const t = defs()['sql_list_foreign_keys'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List foreign keys' })
    expect(t.presentResult({}, { foreignKeys: [{}, {}] })).toMatchObject({ title: '2 foreign key(s)' })
  })

  it('sql_schema_dump pending and result cards', () => {
    const t = defs()['sql_schema_dump'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'Dump schema' })
    expect(t.presentResult({}, { tables: [{}], views: [{}] })).toMatchObject({ title: '1 table(s) · 1 view(s)' })
  })

  it('sql_list_extensions pending and result cards', () => {
    const t = defs()['sql_list_extensions'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List extensions' })
    expect(t.presentResult({}, { supported: true, extensions: [{}, {}] })).toMatchObject({ title: '2 extension(s)' })
    expect(t.presentResult({}, { supported: false, extensions: [] })).toMatchObject({ title: 'Not supported' })
  })

  it('sql_search_tables pending and result cards', () => {
    const t = defs()['sql_search_tables'] as any
    expect(t.presentCall({ pattern: 'order' })).toMatchObject({ card: 'generic', kind: 'search', title: 'Search tables: order' })
    expect(t.presentResult({ pattern: 'order' }, { matches: [{}] })).toMatchObject({ title: '1 object(s)' })
  })

  it('sql_database_size pending and result cards', () => {
    const t = defs()['sql_database_size'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'Database size' })
    expect(t.presentResult({}, { database: 'db', totalBytes: 1024 })).toMatchObject({ title: 'Size: db' })
  })

  it('sql_list_table_sizes pending and result cards', () => {
    const t = defs()['sql_list_table_sizes'] as any
    expect(t.presentCall({})).toMatchObject({ card: 'generic', kind: 'read', title: 'List table sizes' })
    expect(t.presentResult({}, { sizes: [{}, {}] })).toMatchObject({ title: '2 table(s)' })
  })

  it('sql_get_table_comments pending and result cards', () => {
    const t = defs()['sql_get_table_comments'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Comments: users' })
    expect(t.presentResult(args, { table: 'users', columns: [{}, {}] })).toMatchObject({ title: 'Comments: users' })
  })

  it('sql_list_incoming_foreign_keys pending and result cards', () => {
    const t = defs()['sql_list_incoming_foreign_keys'] as any
    const args = { table: 'users' }
    expect(t.presentCall(args)).toMatchObject({ card: 'generic', kind: 'read', title: 'Incoming FKs: users' })
    expect(t.presentResult(args, { table: 'users', foreignKeys: [{}] })).toMatchObject({ title: 'users: 1 reference(s)' })
  })
})
