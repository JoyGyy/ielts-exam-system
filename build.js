#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT_DIR = join(ROOT, 'assets', 'dist');

const isDev = process.argv.includes('--dev');
const isCheck = process.argv.includes('--check');

async function build() {
  // Clean output directory
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const buildOptions = {
    entryPoints: [join(ROOT, 'js', 'app', 'app.js')],
    bundle: true,
    outfile: join(OUT_DIR, 'app.bundle.js'),
    format: 'iife',
    target: ['es2020'],
    sourcemap: true,
    minify: !isDev,
    define: {
      'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
    },
    external: [],
    logLevel: 'info',
  };

  if (isCheck) {
    buildOptions.write = false;
    const result = await esbuild.build(buildOptions);
    console.log(`[check] Build successful (${result.outputFiles?.length || 0} files)`);
    return;
  }

  if (isDev) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[dev] Watching for changes...');
    return;
  }

  await esbuild.build(buildOptions);
  console.log('[build] Production build complete');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
