import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config: runs every workspace as a separate project,
 * so `npm test` from the repo root checks the whole monorepo.
 */
export default defineConfig({
  test: {
    projects: ['shared', 'server', 'client'],
  },
});
