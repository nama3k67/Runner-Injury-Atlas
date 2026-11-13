import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type AppConfig, CONFIG, loadConfig } from '../config';
import { DB, type Db } from './db';
import { schema } from './schema';

const HANDLE = Symbol('DB_HANDLE');

interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

/**
 * DATABASE_URL picks the driver:
 *   postgres://…        node-postgres pool (production, docker compose)
 *   pglite://memory     in-process Postgres, migrated on boot, data lost on exit
 *   pglite://<dir>      in-process Postgres persisted to <dir>
 * PGlite lets a person or an agent run the whole stack with no Docker.
 */
async function connect(config: AppConfig): Promise<DbHandle> {
  if (config.DATABASE_URL.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const target = config.DATABASE_URL.slice('pglite://'.length);
    const client = new PGlite(target === 'memory' ? undefined : target);
    const db = drizzle(client, { schema });
    const here = dirname(fileURLToPath(import.meta.url));
    // src/db (tsx) and dist (bundle) sit at different depths from ./drizzle.
    const folder = here.endsWith('dist')
      ? resolve(here, '../drizzle')
      : resolve(here, '../../drizzle');
    await migrate(db, { migrationsFolder: folder });
    return { db, close: () => client.close() };
  }
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    { provide: HANDLE, inject: [CONFIG], useFactory: connect },
    { provide: DB, inject: [HANDLE], useFactory: (handle: DbHandle) => handle.db },
  ],
  exports: [CONFIG, DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(HANDLE) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
