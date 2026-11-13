import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { schema } from './schema';

export const DB = Symbol('DB');

/** Driver-agnostic handle: node-postgres in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
