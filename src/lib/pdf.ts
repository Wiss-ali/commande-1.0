// PDF des documents commerciaux. La page est écrite en HTML puis convertie par Chromium (sans écran) :
// c'est le seul moyen fiable d'obtenir un arabe correct (lettres liées, droite à gauche).
// Tout texte vient des fichiers de traduction ; toute donnée est échappée avant d'entrer dans la page.
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { numeroTexte, type DocumentComplet, type Mentions } from './documents.ts';
import { formaterTaux, prixHorsTaxe, type ReglagesDocuments } from './fiscal.ts';
import { formaterDate, formaterMontant, formaterTelephone } from './formats.ts';
import { montantEnLettres } from './montant-lettres.ts';
import type { Langue } from './types-bd.ts';

type Textes = Record<string, string>;
const cacheTextes = new Map<Langue, Textes>();
function textes(langue: Langue): Textes {
  let t = cacheTextes.get(langue);
  if (!t) {
    t = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${langue}.json`), 'utf8')).pdf as Textes;
    cacheTextes.set(langue, t);
  }
  return t;
}

/** Texte libre (nom, adresse, désignation) : échappé et isolé, pour qu'un texte français dans une page arabe garde son ordre. */
const libre = (s: string) => `<bdi>${echapper(s)}</bdi>`;
const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let cachePolices: string | undefined;
/** Polices du produit, intégrées dans la page : aucun appel à un site extérieur. */
function polices(): string {
  if (cachePolices === undefined) {
    const dossier = join(process.cwd(), 'node_modules', '@fontsource');
    const regles = [
      ['IBM Plex Sans', 'ibm-plex-sans/files/ibm-plex-sans-latin', 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC'],
      ['IBM Plex Sans Arabic', 'ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic', 'U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF'],
    ].flatMap(([famille, chemin, plage]) =>
      [400, 600].map((graisse) => {
        const fichier = join(dossier, `${chemin}-${graisse}-normal.woff2`);
        if (!existsSync(fichier)) return '';
        return `@font-face{font-family:'${famille}';font-weight:${graisse};src:url(data:font/woff2;base64,${readFileSync(fichier).toString('base64')}) format('woff2');unicode-range:${plage}}`;
      }));
    cachePolices = regles.join('');
  }
  return cachePolices;
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif;font-size:10pt;line-height:1.45;color:#0f172a}
[dir=rtl] body{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif;line-height:1.7}
.m{white-space:nowrap;font-variant-numeric:tabular-nums}
.n{direction:ltr;unicode-bidi:isolate;display:inline-block;font-variant-numeric:tabular-nums}
.tete{display:flex;justify-content:space-between;gap:10mm;border-bottom:1.5pt solid #2563eb;padding-bottom:5mm;margin-bottom:6mm}
.vendeur{max-width:95mm}.vendeur .nom{font-size:15pt;font-weight:600}
.titre{text-align:end}.titre h1{font-size:17pt;font-weight:600;color:#2563eb;text-transform:uppercase}
.petit{font-size:8.5pt;color:#55657d}
.acheteur{border:.75pt solid #d9e3f2;border-radius:2mm;padding:3mm 4mm;margin-bottom:6mm;width:95mm;margin-inline-start:auto}
.acheteur .nom{font-weight:600;font-size:11pt}
table{width:100%;border-collapse:collapse;margin-bottom:5mm}
th{background:#f1f5fb;font-weight:600;font-size:8.5pt;text-align:start;padding:2mm}
td{padding:2mm;border-bottom:.5pt solid #d9e3f2;vertical-align:top}
.d{text-align:end;white-space:nowrap}
tr{break-inside:avoid}
.totaux{width:80mm;margin-inline-start:auto;margin-bottom:5mm}
.totaux div{display:flex;justify-content:space-between;gap:6mm;padding:1mm 2mm}
.totaux .net{font-weight:600;font-size:12pt;border-top:1.5pt solid #1b211f;margin-top:1mm;padding-top:2mm}
.lettres{border-inline-start:2.5pt solid #2563eb;padding:1.5mm 3mm;margin-bottom:5mm;break-inside:avoid}
.lettres b{font-weight:600}
.infos p{margin-bottom:1.2mm}
.signature{margin-top:12mm;width:65mm;margin-inline-start:auto;text-align:center;break-inside:avoid}
.signature div{height:22mm;border:.5pt dashed #d9e3f2;border-radius:2mm;margin-top:1.5mm}
.pied{margin-top:8mm;padding-top:3mm;border-top:.5pt solid #d9e3f2;text-align:center}
.ticket{font-size:9pt}.ticket .centre{text-align:center}.ticket .nom{font-size:12pt;font-weight:600}
.ticket hr{border:0;border-top:.75pt dashed #1b211f;margin:2mm 0}
.ticket .ligne{display:flex;justify-content:space-between;gap:2mm}
.ticket .total{font-size:12pt;font-weight:600}
`;

function blocMentions(m: Mentions, t: Textes): string {
  const ligne = (cle: string, v: string | undefined, nombre = true) => (v ? `<p class="petit">${t[cle]} : <span${nombre ? ' class="n"' : ''}>${echapper(v)}</span></p>` : '');
  return [
    `<p class="nom">${libre(m.nom)}</p>`,
    m.formeJuridique ? `<p>${libre(m.formeJuridique)}</p>` : '',
    m.adresse ? `<p>${libre(m.adresse)}</p>` : '',
    ligne('telephone', m.telephone ? formaterTelephone(m.telephone) : undefined),
    ligne('rc', m.rc), ligne('nif', m.nif), ligne('nis', m.nis), ligne('ai', m.ai),
  ].join('');
}

/** Page HTML complète d'un document, dans la langue demandée. */
export function htmlDocument(d: DocumentComplet, langue: Langue, reglages: ReglagesDocuments): string {
  const t = textes(langue);
  // Le montant suit le sens de la langue : en arabe, le nombre (isolé par formaterMontant) est à droite de la devise.
  const montant = (c: number) => `<span class="m">${echapper(formaterMontant(c, langue))}</span>`;
  const numero = `<span class="n">${numeroTexte(d)}</span>`;
  const date = (x: Date) => `<span class="n">${formaterDate(x)}</span>`;
  const signe = d.type === 'avoir' ? -1 : 1;
  const origine = d.liens.find((l) => l.sens === 'origine');
  const reference = origine ? `<p>${t[origine.nature === 'corrige_par' ? 'annule' : origine.nature === 'regle_par' ? 'regle' : 'suiteDe']} ${t[`type_${origine.type}`]} <span class="n">${numeroTexte(origine)}</span></p>` : '';
  const paiement = d.payeLe
    ? `<p>${t.payeEspeces} ${date(d.payeLe)}</p>`
    : d.modePaiement === 'a_la_livraison'
      ? `<p>${t.payeLivraison}</p>`
      : '';

  if (d.type === 'ticket') {
    const hauteur = 70 + d.lignes.length * 11 + (d.timbre ? 6 : 0) + (reglages.piedDePage ? 12 : 0);
    return `<!doctype html><html lang="${langue}" dir="${langue === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:">
<style>${polices()}${STYLE}@page{size:80mm ${hauteur}mm;margin:4mm}</style></head><body class="ticket">
<div class="centre"><p class="nom">${libre(d.vendeur.nom)}</p>${d.vendeur.adresse ? `<p>${libre(d.vendeur.adresse)}</p>` : ''}${d.vendeur.telephone ? `<p class="n">${echapper(formaterTelephone(d.vendeur.telephone))}</p>` : ''}</div>
<hr><div class="ligne"><span>${t.type_ticket} ${numero}</span><span>${date(d.emisLe)}</span></div><hr>
${d.lignes.map((l) => `<p>${libre(l.designation)}</p><div class="ligne"><span class="n">${l.quantite} × ${echapper(formaterMontant(l.prixUnitaire, 'fr').replace(/ DA$/, ''))}</span>${montant(l.totalTtc)}</div>`).join('')}
<hr>${d.timbre ? `<div class="ligne"><span>${t.timbre}</span>${montant(d.timbre)}</div>` : ''}
<div class="ligne total"><span>${t.total}</span>${montant(d.total)}</div>
<p>${t.payeEspeces} ${date(d.emisLe)}</p>
${reglages.piedDePage ? `<hr><p class="centre">${libre(reglages.piedDePage)}</p>` : ''}
</body></html>`;
  }

  const avecTva = d.lignes.some((l) => l.tauxTva > 0);
  const parTaux = new Map<number, number>();
  for (const l of d.lignes) if (l.tauxTva) parTaux.set(l.tauxTva, (parTaux.get(l.tauxTva) ?? 0) + (l.totalTtc - l.totalHt));
  const totalTtc = signe * d.total - d.timbre;
  const lignes = d.lignes
    .map((l) =>
      avecTva
        ? `<tr><td>${libre(l.designation)}</td><td class="d"><span class="n">${l.quantite}</span></td><td class="d">${montant(prixHorsTaxe(l.prixUnitaire, l.tauxTva))}</td><td class="d"><span class="n">${formaterTaux(l.tauxTva)}</span></td><td class="d">${montant(l.totalHt)}</td></tr>`
        : `<tr><td>${libre(l.designation)}</td><td class="d"><span class="n">${l.quantite}</span></td><td class="d">${montant(l.prixUnitaire)}</td><td class="d">${montant(l.totalTtc)}</td></tr>`)
    .join('');
  const entetes = avecTva
    ? `<th>${t.designation}</th><th class="d">${t.quantite}</th><th class="d">${t.prixHt}</th><th class="d">${t.tva}</th><th class="d">${t.totalHt}</th>`
    : `<th>${t.designation}</th><th class="d">${t.quantite}</th><th class="d">${t.prixUnitaire}</th><th class="d">${t.total}</th>`;
  const blocTotaux = d.type === 'recu'
    ? `<div class="net"><span>${t.montantRecu}</span>${montant(d.total)}</div>`
    : [
        avecTva ? `<div><span>${t.totalHt}</span>${montant(signe * d.totalHt)}</div>` : '',
        ...[...parTaux].sort((a, b) => a[0] - b[0]).map(([taux, tva]) => `<div><span>${t.tva} <span class="n">${formaterTaux(taux)}</span></span>${montant(tva)}</div>`),
        avecTva || d.timbre ? `<div><span>${t.totalTtc}</span>${montant(totalTtc)}</div>` : '',
        d.timbre ? `<div><span>${t.timbre}</span>${montant(d.timbre)}</div>` : '',
        `<div class="net"><span>${t[d.type === 'avoir' ? 'netRembourser' : 'netPayer']}</span>${montant(signe * d.total)}</div>`,
      ].join('');
  const enLettres = d.type === 'bon_livraison' ? '' : `<p class="lettres">${t[`arrete_${d.type}`] ?? t.arrete} <b>${echapper(montantEnLettres(signe * d.total, langue))}</b>.</p>`;

  return `<!doctype html><html lang="${langue}" dir="${langue === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:">
<style>${polices()}${STYLE}@page{size:A4;margin:14mm}</style></head><body>
<div class="tete"><div class="vendeur">${blocMentions(d.vendeur, t)}</div>
<div class="titre"><h1>${t[`type_${d.type}`]}</h1><p>${t.numero} ${numero}</p><p>${t.date} ${date(d.emisLe)}</p>${d.valideJusqua ? `<p class="petit">${t.valable} ${date(d.valideJusqua)}</p>` : ''}</div></div>
${d.acheteur ? `<div class="acheteur"><p class="petit">${t[d.type === 'avoir' || d.type === 'recu' || d.type === 'facture' ? 'client' : 'destinataire']}</p>${blocMentions(d.acheteur, t)}</div>` : ''}
${d.lignes.length ? `<table><thead><tr>${entetes}</tr></thead><tbody>${lignes}</tbody></table>` : ''}
<div class="totaux">${blocTotaux}</div>
${enLettres}
<div class="infos">${reference}${paiement}
${!avecTva && reglages.mentionSansTva && d.type !== 'recu' ? `<p>${libre(reglages.mentionSansTva)}</p>` : ''}
${d.type === 'proforma' ? `<p>${t.mentionProforma}</p>` : ''}
${d.note ? `<p>${libre(d.note)}</p>` : ''}</div>
${d.type === 'facture' || d.type === 'avoir' || d.type === 'bon_livraison' ? `<div class="signature"><p class="petit">${t[d.type === 'bon_livraison' ? 'signatureClient' : 'cachet']}</p><div></div></div>` : ''}
${reglages.piedDePage ? `<p class="pied petit">${libre(reglages.piedDePage)}</p>` : ''}
</body></html>`;
}

// Le « headless shell » de Chromium (version sans interface) est préféré : il est plus léger et plus fiable
// en ligne de commande. À défaut, un Chromium complet lancé avec --headless.
function chromium(): string {
  if (process.env.CHEMIN_CHROMIUM) return process.env.CHEMIN_CHROMIUM;
  const candidats = ['/usr/bin/chromium-headless-shell', '/usr/bin/chrome-headless-shell'];
  const playwright = '/opt/pw-browsers';
  if (existsSync(playwright)) {
    for (const dossier of readdirSync(playwright).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
      candidats.push(join(playwright, dossier, 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
    }
  }
  candidats.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  const chemin = candidats.find((c) => existsSync(c));
  if (!chemin) throw new Error('Chromium introuvable : définir CHEMIN_CHROMIUM');
  return chemin;
}

/** Convertit une page HTML en PDF. Chromium tourne sans écran, sans réseau utile, le temps d'une page. */
export async function enPdf(html: string): Promise<Buffer> {
  const dossier = await mkdtemp(join(tmpdir(), 'hanout-pdf-'));
  try {
    const page = join(dossier, 'page.html');
    const sortie = join(dossier, 'page.pdf');
    await writeFile(page, html, 'utf8');
    await new Promise<void>((fini, echec) => {
      execFile(
        chromium(),
        ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-pdf-header-footer', `--user-data-dir=${join(dossier, 'profil')}`, `--print-to-pdf=${sortie}`, pathToFileURL(page).href],
        { timeout: 30_000 },
        (erreur) => (erreur || !existsSync(sortie) ? echec(new Error('Conversion PDF impossible')) : fini()),
      );
    });
    return await readFile(sortie);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}
