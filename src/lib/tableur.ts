// Lecture et écriture de tableaux Excel (.xlsx) et CSV, sans bibliothèque de tableur.
// Un fichier .xlsx est une archive ZIP de fichiers XML : on n'en lit que les valeurs des cellules
// de la première feuille. Utilisable dans le navigateur (import) comme sur le serveur (modèle, exports).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MAX_LIGNES = 2000;
const MAX_COLONNES = 30;
const MAX_CELLULE = 200;
const MAX_OCTETS_XML = 30_000_000;

export class TableurIllisible extends Error {}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decoder = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITES[e.toLowerCase()] ?? tout;
  });
const coder = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

/** Texte d'un élément <si> ou <is> : la suite de ses <t>, sans les indications de prononciation. */
const texteRiche = (xml: string) =>
  decoder([...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** « B12 » → 1 (colonne B). */
function indexColonne(reference: string): number {
  let n = 0;
  for (const c of reference) {
    if (c < 'A' || c > 'Z') break;
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Un nombre lu dans le fichier, écrit comme l'utilisateur le voit (« 6130000000019 », pas « 6.13E12 »). */
function nombre(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? n.toFixed(0) : String(Math.round(n * 10_000) / 10_000);
}

const nettoyer = (lignes: string[][]) => {
  const propres = lignes.map((l) => l.slice(0, MAX_COLONNES).map((c) => (c ?? '').trim().slice(0, MAX_CELLULE)));
  while (propres.length && propres[propres.length - 1]!.every((c) => !c)) propres.pop();
  if (propres.length > MAX_LIGNES + 1) throw new TableurIllisible('trop_de_lignes');
  return propres;
};

export function lireXlsx(octets: Uint8Array): string[][] {
  let fichiers: Record<string, Uint8Array>;
  try {
    // Seuls les fichiers utiles sont décompressés, et jamais au-delà d'une taille raisonnable.
    fichiers = unzipSync(octets, {
      filter: (f) => (f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)) && f.originalSize <= MAX_OCTETS_XML,
    });
  } catch {
    throw new TableurIllisible('fichier_illisible');
  }
  const feuille = Object.keys(fichiers)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0];
  if (!feuille) throw new TableurIllisible('fichier_illisible');
  const partagees = fichiers['xl/sharedStrings.xml']
    ? [...strFromU8(fichiers['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => texteRiche(m[1] ?? ''))
    : [];
  const lignes: string[][] = [];
  for (const rangee of strFromU8(fichiers[feuille]!).matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(rangee[1]!.match(/\br="(\d+)"/)?.[1] ?? lignes.length + 1);
    if (numero > MAX_LIGNES + 1) throw new TableurIllisible('trop_de_lignes');
    const ligne: string[] = [];
    let suivante = 0;
    for (const cellule of (rangee[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributs = cellule[1]!;
      const reference = attributs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const colonne = reference ? indexColonne(reference) : suivante;
      suivante = colonne + 1;
      if (colonne >= MAX_COLONNES) continue;
      const type = attributs.match(/\bt="(\w+)"/)?.[1];
      const corps = cellule[2] ?? '';
      const v = corps.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
      let valeur = '';
      if (type === 'inlineStr') valeur = texteRiche(corps);
      else if (v === undefined) valeur = '';
      else if (type === 's') valeur = partagees[Number(v)] ?? '';
      else if (type === 'str' || type === 'b' || type === 'e') valeur = decoder(v);
      else valeur = nombre(v);
      ligne[colonne] = valeur;
    }
    lignes[numero - 1] = Array.from(ligne, (c) => c ?? '');
  }
  return nettoyer(Array.from(lignes, (l) => l ?? []));
}

export function lireCsv(octets: Uint8Array): string[][] {
  let texte: string;
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    // Excel enregistre souvent les CSV dans l'ancien codage Windows (arabe et lettres accentuées).
    texte = new TextDecoder('windows-1256').decode(octets);
  }
  texte = texte.replace(/^﻿/, '');
  const premiere = texte.slice(0, texte.search(/\r?\n|$/));
  const compte = (c: string) => premiere.split(c).length - 1;
  const separateur = [';', '\t', ','].sort((a, b) => compte(b) - compte(a))[0]!;
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = '';
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (entreGuillemets) {
      if (c !== '"') champ += c;
      else if (texte[i + 1] === '"') { champ += '"'; i++; }
      else entreGuillemets = false;
    } else if (c === '"' && champ === '') entreGuillemets = true;
    else if (c === separateur) { ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(champ);
      lignes.push(ligne);
      if (lignes.length > MAX_LIGNES + 1) throw new TableurIllisible('trop_de_lignes');
      ligne = [];
      champ = '';
    } else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return nettoyer(lignes);
}

/** Lit un fichier d'après son contenu : une archive ZIP commence par « PK ». */
export function lireTableur(octets: Uint8Array): string[][] {
  if (octets.length > 5_000_000) throw new TableurIllisible('fichier_trop_gros');
  return octets[0] === 0x50 && octets[1] === 0x4b ? lireXlsx(octets) : lireCsv(octets);
}

/** Écrit un classeur .xlsx d'une feuille. Les nombres restent des nombres, le reste est du texte. */
export function ecrireXlsx(lignes: (string | number)[][], o: { droiteAGauche?: boolean; largeurs?: number[] } = {}): Uint8Array {
  const lettre = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + (i % 26));
  const rangees = lignes
    .map((l, r) =>
      `<row r="${r + 1}">${l
        .map((v, c) => {
          const ref = `${lettre(c)}${r + 1}`;
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          return v === '' ? '' : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${coder(v)}</t></is></c>`;
        })
        .join('')}</row>`)
    .join('');
  const colonnes = o.largeurs?.length ? `<cols>${o.largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const vues = `<sheetViews><sheetView workbookViewId="0"${o.droiteAGauche ? ' rightToLeft="1"' : ''}/></sheetViews>`;
  const xml = (corps: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${corps}`);
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipSync({
    '[Content_Types].xml': xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    '_rels/.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': xml(`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="Feuille1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': xml(`<worksheet xmlns="${ns}">${vues}${colonnes}<sheetData>${rangees}</sheetData></worksheet>`),
  });
}
