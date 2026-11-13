import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript source, so they are bundled in.
  noExternal: [/^@atlas\//],
});
