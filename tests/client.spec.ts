import { describe, expect, it, vi } from 'vitest'
import { assertReadOnly, DbClient, SqlError } from '../src/client.ts'
import type { Driver } from '../src/client.ts'

describe('assertReadOnly', () => {
  it('accepts read-only prefixes', () => {
    expect(() => assertReadOnly('SELECT * FROM users')).not.toThrow()
    expect(() => assertReadOnly('select id, name from users limit 10;')).not.toThrow()
    expect(() => assertReadOnly('EXPLAIN SELECT * FROM users')).not.toThrow()
    expect(() => assertReadOnly('SHOW TABLES')).not.toThrow()
    expect(() => assertReadOnly('DESCRIBE users')).not.toThrow()
    expect(() => assertReadOnly('WITH recent AS (SELECT * FROM users) SELECT * FROM recent')).not.toThrow()
    expect(() => assertReadOnly('VALUES (1, 2), (3, 4)')).not.toThrow()
  })

  it('rejects write statements', () => {
    for (const sql of [
      'INSERT INTO users (name) VALUES (\'a\')',
      'UPDATE users SET name = \'a\'',
      'DELETE FROM users',
      'DROP TABLE users',
      'ALTER TABLE users ADD COLUMN x int',
      'CREATE TABLE x (id int)',
      'TRUNCATE TABLE users',
      'GRANT ALL ON users TO bob',
      'REVOKE SELECT ON users FROM bob',
      'RENAME TABLE a TO b',
      'REPLACE INTO users (id) VALUES (1)',
      'MERGE INTO users USING x ON ...',
      'CALL my_proc()',
      'COPY users TO STDOUT',
      'VACUUM users',
    ]) {
      expect(() => assertReadOnly(sql), sql).toThrow(SqlError)
    }
  })

  it('rejects write keywords hidden inside a select', () => {
    expect(() => assertReadOnly('SELECT * FROM audit_log WHERE action = \'delete\'')).toThrow(SqlError)
    expect(() => assertReadOnly('SELECT * FROM log WHERE message LIKE \'%update%\'')).toThrow(SqlError)
  })

  it('rejects empty statements', () => {
    expect(() => assertReadOnly('')).toThrow(SqlError)
    expect(() => assertReadOnly('   ;')).toThrow(SqlError)
  })

  it('rejects non-whitelisted first words', () => {
    expect(() => assertReadOnly('FETCH ALL FROM cursor')).toThrow(/not allowed/)
  })
})

function mockDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    query: vi.fn(async () => ({ columns: ['id'], rows: [{ id: 1 }] })),
    listTables: vi.fn(async () => ['users', 'orders']),
    describeTable: vi.fn(async () => [{ name: 'id', type: 'integer', nullable: false, defaultValue: null }]),
    close: vi.fn(async () => {}),
    ...overrides,
  }
}

function makeClient(driver: Driver, config: Record<string, unknown> = {}) {
  return new DbClient({
    type: 'postgres',
    host: 'localhost',
    user: 'u',
    password: 'p',
    database: 'db',
    ...config,
  }, driver)
}

describe('DbClient.query', () => {
  it('returns columns, rows, rowCount, truncated:false', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    const result = await client.query('SELECT * FROM users')
    expect(result).toEqual({
      columns: ['id'],
      rows: [{ id: 1 }],
      rowCount: 1,
      truncated: false,
    })
    expect(driver.query).toHaveBeenCalledWith('SELECT * FROM users', expect.anything())
  })

  it('truncates rows beyond maxRows and reports truncated:true', async () => {
    const rows = Array.from({ length: 150 }, (_, i) => ({ id: i }))
    const driver = mockDriver({ query: vi.fn(async () => ({ columns: ['id'], rows })) })
    const client = makeClient(driver, { maxRows: 100 })
    const result = await client.query('SELECT * FROM big')
    expect(result.rows).toHaveLength(100)
    expect(result.rowCount).toBe(150)
    expect(result.truncated).toBe(true)
  })

  it('rejects write statements before touching the driver', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    await expect(client.query('DELETE FROM users')).rejects.toThrow(SqlError)
    expect(driver.query).not.toHaveBeenCalled()
  })

  it('maps driver errors to SqlError with kind query', async () => {
    const driver = mockDriver({ query: vi.fn(async () => { throw new Error('syntax error') }) })
    const client = makeClient(driver)
    await expect(client.query('SELECT bad sql')).rejects.toMatchObject({ kind: 'query', message: 'syntax error' })
  })

  it('keeps SqlError from the driver intact', async () => {
    const driver = mockDriver({ query: vi.fn(async () => { throw new SqlError('denied', 'denied') }) })
    const client = makeClient(driver)
    await expect(client.query('SELECT * FROM users')).rejects.toMatchObject({ kind: 'denied' })
  })
})

describe('DbClient.listTables / describeTable', () => {
  it('listTables returns table names', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listTables()).toEqual(['users', 'orders'])
  })

  it('describeTable returns column info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.describeTable('users')).toEqual([
      { name: 'id', type: 'integer', nullable: false, defaultValue: null },
    ])
  })

  it('maps errors from listTables', async () => {
    const driver = mockDriver({ listTables: vi.fn(async () => { throw new Error('conn refused') }) })
    const client = makeClient(driver)
    await expect(client.listTables()).rejects.toMatchObject({ kind: 'query', message: 'conn refused' })
  })
})
