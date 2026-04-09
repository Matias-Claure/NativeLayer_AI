import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL environment variable is required');
    _pool = new Pool({ connectionString: url, max: 10 });
  }
  return _pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Db = ReturnType<typeof getDb>;
