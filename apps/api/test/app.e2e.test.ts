import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { type AppConfig, CONFIG } from '../src/config';

const ADMIN = 'test-admin-key-test-admin-key';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

let app: INestApplication;

// Real Postgres semantics without Docker: pglite://memory runs Postgres
// in-process and applies the real migrations, so schema drift fails here first.
beforeAll(async () => {
  const config: AppConfig = {
    PORT: 0,
    DATABASE_URL: 'pglite://memory',
    ADMIN_API_KEY: ADMIN,
    CORS_ORIGIN: 'http://localhost:3000',
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG)
    .useValue(config)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

const http = () => request(app.getHttpServer());

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const res = await http().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});

describe('feedback', () => {
  it('accepts anonymous feedback about content', async () => {
    const res = await http()
      .post('/api/feedback')
      .send({
        injurySlug: 'itbs',
        target: 'fatpad',
        kind: 'unclear',
        message: 'Chưa hiểu vì sao lớp mỡ bị ép.',
      })
      .expect(201);
    expect(res.body).toMatchObject({ injurySlug: 'itbs', status: 'open', kind: 'unclear' });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects invalid bodies with the failing paths', async () => {
    const res = await http()
      .post('/api/feedback')
      .send({ injurySlug: 'ITBS!', kind: 'rant', message: 'ngắn' })
      .expect(400);
    const paths = res.body.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['injurySlug', 'kind', 'message']));
  });

  it('strips fields outside the contract, such as contact details', async () => {
    const res = await http()
      .post('/api/feedback')
      .send({
        injurySlug: 'itbs',
        kind: 'error',
        message: 'Nguồn số 3 bị sai năm xuất bản.',
        email: 'a@b.c',
      })
      .expect(201);
    expect(res.body).not.toHaveProperty('email');
  });

  it('keeps the inbox behind the admin key', async () => {
    await http().get('/api/feedback').expect(401);
    await http().get('/api/feedback').set('x-admin-key', 'wrong').expect(401);
    const res = await http().get('/api/feedback?status=open').set('x-admin-key', ADMIN).expect(200);
    expect(res.body.length).toBe(2);
  });

  it('resolves feedback and 404s on unknown ids', async () => {
    const list = await http().get('/api/feedback').set('x-admin-key', ADMIN);
    const id = list.body[0].id;
    const res = await http()
      .patch(`/api/feedback/${id}/resolve`)
      .set('x-admin-key', ADMIN)
      .expect(200);
    expect(res.body.status).toBe('resolved');
    await http()
      .patch('/api/feedback/00000000-0000-4000-8000-000000000000/resolve')
      .set('x-admin-key', ADMIN)
      .expect(404);
  });
});

describe('medical review workflow', () => {
  const badge = (hash: string) =>
    http().get(`/api/reviews/badge?injurySlug=itbs&contentHash=${hash}`).expect(200);
  const decision = {
    verdict: 'approved',
    reviewerName: 'Nguyễn Văn A',
    reviewerTitle: 'Chuyên viên vật lý trị liệu',
  };
  let reviewId: string;

  it('shows content as not reviewed by default', async () => {
    expect((await badge(HASH_A)).body).toMatchObject({ reviewed: false, reviewerName: null });
  });

  it('only lets an admin open a review round, and is idempotent', async () => {
    await http().post('/api/reviews').send({ injurySlug: 'itbs', contentHash: HASH_A }).expect(401);
    const first = await http()
      .post('/api/reviews')
      .set('x-admin-key', ADMIN)
      .send({ injurySlug: 'itbs', contentHash: HASH_A })
      .expect(201);
    const again = await http()
      .post('/api/reviews')
      .set('x-admin-key', ADMIN)
      .send({ injurySlug: 'itbs', contentHash: HASH_A })
      .expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(first.body.status).toBe('pending');
    reviewId = first.body.id;
  });

  it('a pending round does not make content reviewed', async () => {
    expect((await badge(HASH_A)).body.reviewed).toBe(false);
  });

  it('approval marks exactly that content hash as reviewed', async () => {
    const res = await http()
      .post(`/api/reviews/${reviewId}/decision`)
      .set('x-admin-key', ADMIN)
      .send(decision)
      .expect(200);
    expect(res.body).toMatchObject({ status: 'approved', reviewerName: 'Nguyễn Văn A' });
    expect((await badge(HASH_A)).body).toMatchObject({
      reviewed: true,
      reviewerTitle: 'Chuyên viên vật lý trị liệu',
    });
    // Edited content has a different hash and is NOT covered by the approval.
    expect((await badge(HASH_B)).body.reviewed).toBe(false);
  });

  it('refuses to decide a round twice', async () => {
    await http()
      .post(`/api/reviews/${reviewId}/decision`)
      .set('x-admin-key', ADMIN)
      .send({ ...decision, verdict: 'changes_requested' })
      .expect(409);
  });

  it('"changes requested" never marks content as reviewed', async () => {
    const round = await http()
      .post('/api/reviews')
      .set('x-admin-key', ADMIN)
      .send({ injurySlug: 'itbs', contentHash: HASH_B })
      .expect(201);
    await http()
      .post(`/api/reviews/${round.body.id}/decision`)
      .set('x-admin-key', ADMIN)
      .send({ ...decision, verdict: 'changes_requested', notes: 'Cần sửa phần test Ober.' })
      .expect(200);
    expect((await badge(HASH_B)).body.reviewed).toBe(false);
  });

  it('validates hashes and ids', async () => {
    await http().get('/api/reviews/badge?injurySlug=itbs&contentHash=xyz').expect(400);
    await http()
      .post('/api/reviews/not-a-uuid/decision')
      .set('x-admin-key', ADMIN)
      .send(decision)
      .expect(400);
  });
});
