import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const avecIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', 'pg', 'sharp'],
  // Photos de produits (réduites dans le navigateur avant l'envoi) et tableaux d'import.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};

export default avecIntl(config);
