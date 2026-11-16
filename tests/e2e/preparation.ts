// Base de test neuve et compte administrateur, avant les tests de bout en bout.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import bwipjs from 'bwip-js/node';
import sharp from 'sharp';
import preparerBD from '../preparation-bd.ts';

/** Code-barres montré à la fausse caméra du navigateur de test. */
export const CODE_CAMERA = '6130000000015';
export const VIDEO_CAMERA = '.cache-tests/camera.mjpeg';

export default async function preparer() {
  await preparerBD();
  execFileSync('npx', ['tsx', 'scripts/creer-admin.ts', 'admin@test.dz'], { env: process.env, stdio: 'pipe' });
  // Une « vidéo » d'une seule image : un code-barres EAN-13 sur fond blanc, comme vu par l'appareil photo.
  const code = await bwipjs.toBuffer({ bcid: 'ean13', text: CODE_CAMERA, scale: 4, height: 25, includetext: true, backgroundcolor: 'FFFFFF', padding: 10 });
  const image = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#ffffff' } }).composite([{ input: code, gravity: 'centre' }]).jpeg({ quality: 90 }).toBuffer();
  mkdirSync('.cache-tests', { recursive: true });
  writeFileSync(VIDEO_CAMERA, image);
}
