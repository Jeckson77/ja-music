import { defineConfig } from 'vite';
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Keep the existing functional Listener / Studio demo accessible while its
// UI is migrated into React. Do not overwrite React's generated index.html.
export default defineConfig({
  // React Bits uses JSX without importing the React namespace in every file.
  esbuild: { jsx: 'automatic' },
  base: process.env.GITHUB_PAGES === 'true' ? '/ja-music/' : '/',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [{
    name: 'preserve-existing-demo-assets',
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      for (const file of ['ja_music_dual_demo.html', 'ja_music_logo.png']) {
        if (existsSync(file)) copyFileSync(file, join('dist', file));
      }
      if (existsSync('assets')) cpSync('assets', 'dist/assets', { recursive: true });
    }
  }]
});
