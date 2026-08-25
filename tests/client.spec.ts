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

describe('DbClient v0.2 methods', () => {
  it('listIndexes returns index info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listIndexes('users')).toEqual([
      { name: 'users_pkey', columns: ['id'], unique: true },
    ])
  })

  it('databaseInfo returns server info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.databaseInfo()).toMatchObject({ version: 'PostgreSQL 16', database: 'db' })
  })

  it('tableStats returns estimated row counts', async () => {
    const client = makeClient(mockDriver())
    expect(await client.tableStats()).toEqual([{ table: 'users', schema: 'public', estimatedRows: 100 }])
  })

  it('searchColumns normalizes a bare pattern to %pattern%', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    await client.searchColumns('user')
    expect(driver.searchColumns).toHaveBeenCalledWith('%user%', expect.anything())
  })

  it('searchColumns passes through patterns that already contain %', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    await client.searchColumns('%created_%')
    expect(driver.searchColumns).toHaveBeenCalledWith('%created_%', expect.anything())
  })

  it('maps driver errors from v0.2 methods to SqlError', async () => {
    const driver = mockDriver({ listIndexes: vi.fn(async () => { throw new Error('boom') }) })
    const client = makeClient(driver)
    await expect(client.listIndexes('users')).rejects.toMatchObject({ kind: 'query', message: 'boom' })
  })

  it('ping runs SELECT 1 and reports ok', async () => {
    const client = makeClient(mockDriver())
    const result = await client.ping()
    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('ping surfaces query failures as errors', async () => {
    const driver = mockDriver({ query: vi.fn(async () => { throw new Error('conn refused') }) })
    const client = makeClient(driver)
    await expect(client.ping()).rejects.toMatchObject({ kind: 'query' })
  })

  it('listViews returns view info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listViews()).toEqual([
      { name: 'active_users', definition: 'SELECT * FROM users WHERE active' },
    ])
  })

  it('tableSize returns byte sizes', async () => {
    const client = makeClient(mockDriver())
    expect(await client.tableSize('users')).toEqual({ table: 'users', dataBytes: 1024, indexBytes: 512, totalBytes: 1536 })
  })

  it('getSchema returns DDL', async () => {
    const client = makeClient(mockDriver())
    expect(await client.getSchema('users')).toEqual({ table: 'users', ddl: 'CREATE TABLE users (id integer);', simplified: true })
  })

  it('previewTable validates the table name before touching the driver', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    await expect(client.previewTable('users; DROP TABLE x', 10)).rejects.toMatchObject({ kind: 'denied' })
    expect(driver.previewTable).not.toHaveBeenCalled()
  })

  it('previewTable returns rows and truncates to limit', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }))
    const driver = mockDriver({ previewTable: vi.fn(async () => ({ columns: ['id'], rows })) })
    const client = makeClient(driver)
    const result = await client.previewTable('users', 10)
    expect(result.rows).toHaveLength(10)
    expect(result.rowCount).toBe(25)
    expect(result.truncated).toBe(true)
    expect(driver.previewTable).toHaveBeenCalledWith('users', 10, expect.anything())
  })

  it('listFunctions/listTriggers/listForeignKeys return object info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listFunctions()).toEqual([
      { name: 'add', arguments: 'a int, b int', language: 'sql', returnType: 'integer' },
    ])
    expect(await client.listTriggers()).toEqual([
      { name: 'trg', table: 'users', timing: 'AFTER', event: 'INSERT', definition: 'CREATE TRIGGER ...' },
    ])
    expect(await client.listForeignKeys()).toEqual([
      { name: 'fk', table: 'orders', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
    ])
  })

  it('schemaDump returns tables and views', async () => {
    const client = makeClient(mockDriver())
    const dump = await client.schemaDump()
    expect(dump.tables).toHaveLength(1)
    expect(dump.views[0]).toMatchObject({ name: 'active_users' })
  })

  it('query honors a maxRows override smaller than the configured max', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }))
    const driver = mockDriver({ query: vi.fn(async () => ({ columns: ['id'], rows })) })
    const client = makeClient(driver, { maxRows: 100 })
    const result = await client.query('SELECT * FROM users', undefined, 10)
    expect(result.rows).toHaveLength(10)
    expect(result.truncated).toBe(true)
  })

  it('listExtensions returns extension info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listExtensions()).toEqual([{ name: 'pg_trgm', version: '1.6' }])
  })

  it('listSchemas/listSequences/listConstraints return discovery info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listSchemas()).toEqual(['public', 'audit'])
    expect(await client.listSequences()).toEqual([
      { name: 'users_id_seq', dataType: 'integer', startValue: '1', increment: '1' },
    ])
    expect(await client.listConstraints()).toEqual([
      { name: 'users_pkey', table: 'users', type: 'PRIMARY KEY', columns: ['id'], definition: 'PRIMARY KEY (id)' },
      { name: 'users_age_check', table: 'users', type: 'CHECK', columns: [], definition: 'CHECK ((age >= 0))' },
    ])
  })

  it('maps driver errors from v0.6 methods to SqlError', async () => {
    const driver = mockDriver({ listConstraints: vi.fn(async () => { throw new Error('catalog unavailable') }) })
    const client = makeClient(driver)
    await expect(client.listConstraints()).rejects.toMatchObject({ kind: 'query', message: 'catalog unavailable' })
  })

  it('v0.7 discovery methods return database/role/grant/object info', async () => {
    const client = makeClient(mockDriver())
    expect(await client.listDatabases()).toEqual([{ name: 'app' }, { name: 'audit' }])
    expect(await client.listRoles()).toEqual([
      { name: 'readonly', roleType: 'role', attributes: ['can login'], detail: 'no connection limit' },
    ])
    expect(await client.listGrants()).toEqual([
      { grantee: 'app_user', object: 'public.users', privilege: 'SELECT', grantable: false },
    ])
    expect(await client.listMaterializedViews()).toEqual([
      { name: 'daily_sales', definition: 'SELECT * FROM sales WHERE day = CURRENT_DATE' },
    ])
    expect(await client.listPartitions()).toEqual([
      { parent: 'orders', partition: 'orders_2026', method: 'RANGE', bound: 'FOR VALUES FROM (\'2026-01-01\') TO (\'2027-01-01\')', estimatedRows: 100 },
    ])
  })

  it('getTableRowCount validates the table name before touching the driver', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    await expect(client.getTableRowCount('users; DROP TABLE x')).rejects.toMatchObject({ kind: 'denied' })
    expect(driver.getTableRowCount).not.toHaveBeenCalled()
  })

  it('getTableRowCount returns an exact count through the driver', async () => {
    const driver = mockDriver()
    const client = makeClient(driver)
    expect(await client.getTableRowCount('users')).toEqual({ table: 'users', rowCount: 42 })
    expect(driver.getTableRowCount).toHaveBeenCalledWith('users', expect.anything())
  })

  it('maps driver errors from v0.7 methods to SqlError', async () => {
    const driver = mockDriver({ listDatabases: vi.fn(async () => { throw new Error('catalog unavailable') }) })
    const client = makeClient(driver)
    await expect(client.listDatabases()).rejects.toMatchObject({ kind: 'query', message: 'catalog unavailable' })
  })
})
