import type { MetadataRoute } from 'next';

// Rend l'application installable sur l'écran d'accueil du téléphone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hanout',
    short_name: 'Hanout',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafbfe',
    theme_color: '#2563eb',
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
