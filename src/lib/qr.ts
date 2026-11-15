// QR code en image SVG (adresse « data: »), produit sur le serveur.
import bwipjs from 'bwip-js/node';

export function qrEnImage(contenu: string): string {
  const svg = bwipjs.toSVG({ bcid: 'qrcode', text: contenu, scale: 4, padding: 4, backgroundcolor: 'FFFFFF' });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
