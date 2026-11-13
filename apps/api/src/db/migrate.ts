import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadConfig } from '../config';

const here = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: loadConfig().DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: resolve(here, '../../drizzle') });
await pool.end();
console.log('migrations applied');
