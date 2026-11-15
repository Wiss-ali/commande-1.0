// Dessin des codes-barres des étiquettes, sur le serveur, en image SVG (adresse « data: »).
import bwipjs from 'bwip-js/node';
import { symbologie } from './codes-barres.ts';

/** Image du code : code-barres (EAN si le code est un EAN valide, sinon Code 128) ou QR code. */
export function codeEnImage(code: string, forme: 'barres' | 'qr'): string {
  const type = forme === 'qr' ? 'qrcode' : symbologie(code);
  const svg =
    type === 'qrcode'
      ? bwipjs.toSVG({ bcid: 'qrcode', text: code, scale: 3, padding: 2, backgroundcolor: 'FFFFFF' })
      : bwipjs.toSVG({ bcid: type, text: code, scale: 2, height: type === 'code128' ? 10 : 14, includetext: true, textxalign: 'center', padding: 2, backgroundcolor: 'FFFFFF' });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
