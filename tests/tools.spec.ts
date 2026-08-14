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
    close: vi.fn(async () => {}),
    ...overrides,
  }
}

const tools = () => Object.fromEntries(createTools(makeClient(mockDriver())).map(t => [t.name, t]))

describe('tool definitions', () => {
  it('registers the planned tools', () => {
    expect(Object.keys(tools()).sort()).toEqual([
      'sql_database_info',
      'sql_describe_table',
      'sql_explain',
      'sql_get_schema',
      'sql_list_indexes',
      'sql_list_tables',
      'sql_list_views',
      'sql_ping',
      'sql_query',
      'sql_search_columns',
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
})
