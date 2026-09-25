import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Read once at build time so the running game (and bug reports) can show/send which build a
  // player is on — see src/ui/feedback.ts.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Vitest (VITEST env var is set automatically) needs the 'browser' resolve
  // condition or Svelte resolves to its SSR build, which throws on mount() —
  // component tests need the real client build. Doesn't affect `vite build`/`dev`.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    // Default environment stays 'node' — fast for the (much larger) sim/state
    // test suite, which never touches the DOM. Component tests opt into jsdom
    // per-file via a `// @vitest-environment jsdom` docblock at the top.
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts'],
    // @testing-library/svelte's auto render-cleanup between tests only
    // registers itself when beforeEach/afterEach are real globals (see its
    // src/index.js) — every existing test file still imports describe/it/
    // expect explicitly, this only adds the two lifecycle hooks as globals.
    globals: true,
  },
})
