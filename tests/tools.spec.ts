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
    close: vi.fn(async () => {}),
    ...overrides,
  }
}

const tools = () => Object.fromEntries(createTools(makeClient(mockDriver())).map(t => [t.name, t]))

describe('tool definitions', () => {
  it('registers the planned tools', () => {
    expect(Object.keys(tools()).sort()).toEqual(['sql_describe_table', 'sql_list_tables', 'sql_query'])
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
})
