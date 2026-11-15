import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { envTest } from './tests/env-test.ts';

const env = envTest('http://localhost:3000');
// Aussi pour la préparation de la base, qui tourne avant les tests.
Object.assign(process.env, env);

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/preparation-bd.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    env,
  },
});
