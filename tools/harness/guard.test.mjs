import { describe, expect, it } from 'vitest';
import { blockCheckedNoteEdit, blockReason, editFromToolCall } from './guard.mjs';

const edit = (filePath, newText = '') => ({ tool: 'Edit', filePath, newText });

describe('agent guard', () => {
  it('allows ordinary source and content edits', () => {
    expect(blockReason(edit('apps/web/src/routes/index.tsx', 'x'))).toBeNull();
    expect(blockReason(edit('content/terms/itb.json', '{"id":"itb"}'))).toBeNull();
    expect(blockReason(edit('content/injuries/itbs/injury.json', '"status": "draft"'))).toBeNull();
    expect(blockReason(edit('content/injuries/itbs/injury.json', '"review": null'))).toBeNull();
    expect(blockReason(edit('apps/api/.env.example', 'PORT=3001'))).toBeNull();
    expect(blockReason(edit('apps/api/src/db/schema.ts', 'x'))).toBeNull();
  });

  it('keeps publishing and review stamps human-only', () => {
    expect(blockReason(edit('content/injuries/itbs/injury.json', '"status":"published"'))).toMatch(
      /human/,
    );
    expect(
      blockReason(edit('content/injuries/pfps/injury.json', '"review": { "reviewerName": "x" }')),
    ).toMatch(/human/);
  });

  it('lets an agent draft an evidence note but never mark it checked', () => {
    expect(blockReason(edit('content/evidence/r8.json', '"checked": false'))).toBeNull();
    expect(blockReason(edit('content/evidence/r8.json', '"checked" : true'))).toMatch(/maintainer/);
    expect(blockReason(edit('content/sources.json', '"checked": true'))).toBeNull();
  });

  it('keeps a checked evidence note for the maintainer to edit', () => {
    const checked = '{ "source": "r8", "checked": true }';
    expect(blockCheckedNoteEdit('content/evidence/r8.json', checked)).toMatch(/maintainer/);
    expect(blockCheckedNoteEdit('content/evidence/r8.json', '{ "checked": false }')).toBeNull();
    expect(blockCheckedNoteEdit('content/evidence/r8.json', '')).toBeNull();
    expect(blockCheckedNoteEdit('content/terms/itb.json', checked)).toBeNull();
  });

  it('freezes legacy, migrations, lockfile and secrets', () => {
    expect(blockReason(edit('apps/web/public/legacy/v0.3/index.html'))).toMatch(/frozen/);
    expect(blockReason(edit('apps/api/drizzle/0000_init.sql'))).toMatch(/immutable/);
    expect(blockReason(edit('apps/api/drizzle/meta/_journal.json'))).toMatch(/immutable/);
    expect(blockReason(edit('pnpm-lock.yaml'))).toMatch(/lockfile/);
    expect(blockReason(edit('apps/api/.env'))).toMatch(/secrets/);
    expect(blockReason(edit('.env.local'))).toMatch(/secrets/);
  });

  it('reads Write, Edit and MultiEdit tool inputs relative to the project', () => {
    const dir = '/repo';
    expect(editFromToolCall('Write', { file_path: '/repo/a/b.ts', content: 'C' }, dir)).toEqual({
      tool: 'Write',
      filePath: 'a/b.ts',
      newText: 'C',
    });
    expect(
      editFromToolCall('Edit', { file_path: '/repo/a.ts', old_string: 'o', new_string: 'N' }, dir)
        .newText,
    ).toBe('N');
    expect(
      editFromToolCall(
        'MultiEdit',
        { file_path: '/repo/a.ts', edits: [{ new_string: 'A' }, { new_string: 'B' }] },
        dir,
      ).newText,
    ).toBe('A\nB');
  });
});
