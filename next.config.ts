import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const avecIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
};

export default avecIntl(config);
