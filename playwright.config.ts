import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { envTest } from './tests/env-test.ts';

const PORT = 3100;
// Base de test séparée, recréée à chaque lancement (tests/e2e/preparation.ts).
// DOMAINE_BOUTIQUES : chaque boutique répond aussi sur « nom.boutiques.test » (essai de l'adresse en sous-domaine).
export const envE2E = { ...envTest(`http://localhost:${PORT}`), ADMIN_MOT_DE_PASSE: 'administrateur de test 2026', DOMAINE_BOUTIQUES: 'boutiques.test' };
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
    launchOptions: {
      ...(existsSync(chromium) ? { executablePath: chromium } : {}),
      // Fausse caméra : le navigateur « filme » un code-barres (image créée par tests/e2e/preparation.ts).
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${resolve('.cache-tests/camera.mjpeg')}`],
    },
  },
  // Lancer « npm run build » avant « npm run test:e2e ».
  webServer: { command: `npx next start -p ${PORT}`, port: PORT, env: envE2E, reuseExistingServer: false, timeout: 60_000 },
});
