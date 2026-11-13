import { z } from 'zod';

export const CONFIG = Symbol('CONFIG');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  /** Shared secret for reviewer/admin endpoints. Replace with real auth before going public (ADR 0005). */
  ADMIN_API_KEY: z.string().min(24),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}\nSee apps/api/.env.example`);
  }
  return parsed.data;
}
