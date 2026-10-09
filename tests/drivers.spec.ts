import { beforeEach, describe, expect, it, vi } from 'vitest'

const pgState = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  queries: [] as unknown[][],
}))

vi.mock('pg', () => ({
  Client: class MockClient {
    constructor(config: Record<string, unknown>) {
      pgState.config = config
    }

    async connect(): Promise<void> {}

    async query(...args: unknown[]): Promise<{ rows: unknown[]; fields: unknown[] }> {
      pgState.queries.push(args)
      return { rows: [], fields: [] }
    }

    async end(): Promise<void> {}
  },
}))

const mysqlState = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  queries: [] as unknown[][],
}))

vi.mock('mysql2/promise', () => ({
  createConnection: async (config: Record<string, unknown>) => {
    mysqlState.config = config
    return {
      query: async (...args: unknown[]) => {
        mysqlState.queries.push(args)
        return [[], []]
      },
      end: async () => {},
    }
  },
}))

import { createMysqlDriver } from '../src/drivers/mysql.ts'
import { createPostgresDriver } from '../src/drivers/postgres.ts'

const baseConfig = {
  host: 'db.example.test',
  user: 'readonly',
  password: 'secret',
  database: 'app',
} as const

describe('database driver safety session setup', () => {
  beforeEach(() => {
    pgState.config = null
    pgState.queries.length = 0
    mysqlState.config = null
    mysqlState.queries.length = 0
  })

  it('configures PostgreSQL read-only and server/client query timeouts', async () => {
    const driver = await createPostgresDriver({ ...baseConfig, type: 'postgres', timeoutMs: 1234, ssl: true })

    expect(pgState.config).toMatchObject({
      statement_timeout: 1234,
      query_timeout: 1234,
      ssl: { rejectUnauthorized: true },
    })
    expect(pgState.queries.map(args => args[0])).toEqual([
      'SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY',
      'SET SESSION default_transaction_read_only = on',
      'SET SESSION statement_timeout = 1234',
    ])
    await expect(driver.query('DELETE FROM users')).rejects.toMatchObject({ kind: 'denied' })
    expect(pgState.queries).toHaveLength(3)
  })

  it('configures MySQL read-only and MAX_EXECUTION_TIME without weakening TLS', async () => {
    const driver = await createMysqlDriver({ ...baseConfig, type: 'mysql', timeoutMs: 2345, ssl: true })

    expect(mysqlState.config).toMatchObject({
      ssl: { rejectUnauthorized: true },
    })
    expect(mysqlState.queries.map(args => args[0])).toEqual([
      'SET SESSION TRANSACTION READ ONLY',
      'SET SESSION MAX_EXECUTION_TIME = 2345',
    ])
    await expect(driver.query("UPDATE users SET name = 'x'")).rejects.toMatchObject({ kind: 'denied' })
    expect(mysqlState.queries).toHaveLength(2)
  })

  it('allows explicitly configured self-signed TLS without making it the default', async () => {
    await createPostgresDriver({ ...baseConfig, type: 'postgres', ssl: true, sslRejectUnauthorized: false })
    expect(pgState.config).toMatchObject({ ssl: { rejectUnauthorized: false } })

    await createMysqlDriver({ ...baseConfig, type: 'mysql', ssl: true, sslRejectUnauthorized: false })
    expect(mysqlState.config).toMatchObject({ ssl: { rejectUnauthorized: false } })
  })
})
