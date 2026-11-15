import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PORT = 3100;
const pg = process.env.TEST_PG ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
const base = (role: string, mdp: string) => `postgres://${role}:${mdp}@${new URL(pg).host}/hanout_test`;

// Base de test séparée, recréée à chaque lancement (tests/e2e/preparation.ts).
export const envE2E = {
  URL_APP: `http://localhost:${PORT}`,
  DATABASE_URL_SUPER: pg,
  DATABASE_URL_PROPRIETAIRE: base('hanout_proprietaire', 'test_prop'),
  DATABASE_URL_APP: base('hanout_app', 'test_app'),
  DATABASE_URL_AUTH: base('hanout_auth', 'test_auth'),
  DATABASE_URL_PLATEFORME: base('hanout_plateforme', 'test_plat'),
  DATABASE_SSL: 'off',
  CLES_CHIFFREMENT: '1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  CLE_CHIFFREMENT_ACTIVE: '1',
  CLE_HMAC: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
  ADMIN_MOT_DE_PASSE: 'administrateur de test 2026',
};
Object.assign(process.env, envE2E);

const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/preparation.ts',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 360, height: 740 }, // téléphone étroit : la taille de référence du produit
    locale: 'fr-FR',
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  // Lancer « npm run build » avant « npm run test:e2e ».
  webServer: { command: `npx next start -p ${PORT}`, port: PORT, env: envE2E, reuseExistingServer: false, timeout: 60_000 },
});
