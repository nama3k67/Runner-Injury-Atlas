import type { Health } from '@atlas/contracts';
import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async get(): Promise<Health> {
    let db: Health['db'] = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      db = 'down';
    }
    return { status: 'ok', db, version: process.env.npm_package_version ?? 'dev' };
  }
}
