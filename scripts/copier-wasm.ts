// Copie le lecteur de codes-barres (WebAssembly) dans public/wasm : il est servi par l'application
// elle-même, jamais par un site extérieur. Lancé automatiquement avant « dev » et « build ».
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const racine = join(import.meta.dirname, '..');
mkdirSync(join(racine, 'public', 'wasm'), { recursive: true });
copyFileSync(join(racine, 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm'), join(racine, 'public', 'wasm', 'zxing_reader.wasm'));
