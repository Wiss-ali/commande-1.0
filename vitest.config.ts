import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pg = process.env.TEST_PG ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const base = (role: string, mdp: string) => `postgres://${role}:${mdp}@${new URL(pg).host}/hanout_test`;

const env = {
      URL_APP: 'http://localhost:3000',
      DATABASE_URL_SUPER: pg,
      DATABASE_URL_PROPRIETAIRE: base('hanout_proprietaire', 'test_prop'),
      DATABASE_URL_APP: base('hanout_app', 'test_app'),
      DATABASE_URL_AUTH: base('hanout_auth', 'test_auth'),
      DATABASE_URL_PLATEFORME: base('hanout_plateforme', 'test_plat'),
      DATABASE_SSL: 'off',
      // Clés réservées aux tests.
      CLES_CHIFFREMENT: '1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=,2:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      CLE_CHIFFREMENT_ACTIVE: '2',
      CLE_HMAC: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
};
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
