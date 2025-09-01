import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    generate: 'src/generate.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  sourcemap: true,
  splitting: false,
  minify: false,
  // Copy JSON files to dist
  loader: {
    '.json': 'copy',
  },
});
