// Archive pour le comptable : une période, un PDF par document, et des fichiers CSV lisibles dans Excel
// (UTF-8 avec BOM, point-virgule, virgule décimale). Les en-têtes de colonnes viennent des traductions.
import { strToU8, zipSync } from 'fflate';
import { sql } from 'kysely';
import type { Trx } from './bd.ts';
import { dechiffrer, dechiffrerOuNul } from './chiffrement.ts';
import { lireDocument, mentionsVendeur, numeroTexte, type Mentions } from './documents.ts';
import { enPdf, htmlDocument } from './pdf.ts';
import { FUSEAU, type Periode } from './rapports.ts';
import type { Langue, TypeDocument } from './types-bd.ts';

/** Au-delà, la période est trop longue pour une seule archive : choisir un mois. */
export const MAX_DOCUMENTS = 500;

/** Cellule CSV : guillemets doublés, et un texte qui ressemble à une formule est neutralisé (apostrophe). */
export function cellule(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const texte = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}
/** Montant en dinars avec virgule décimale (« 1250,50 »), lisible tel quel par Excel en français. */
export const montantCsv = (centimes: number | string) => {
  const n = Number(centimes);
  const signe = n < 0 ? '-' : '';
  const a = Math.abs(n);
  return `${signe}${Math.trunc(a / 100)},${String(a % 100).padStart(2, '0')}`;
};
export function csv(entetes: string[], lignes: (string | number | null)[][]): Uint8Array {
  const texte = [entetes, ...lignes].map((l) => l.map((c) => (typeof c === 'string' && /^-?\d+,\d{2}$/.test(c) ? c : cellule(c))).join(';')).join('\r\n');
  return strToU8(`﻿${texte}\r\n`);
}

const dateCsv = (d: Date | null) => (d ? new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '');
const dans = (p: Periode) => sql`(d.emis_le AT TIME ZONE ${FUSEAU})::date BETWEEN ${p.du}::date AND ${p.au}::date`;

export async function compterDocuments(trx: Trx, p: Periode): Promise<number> {
  const r = await sql<{ n: number }>`SELECT count(*)::int AS n FROM documents d WHERE d.type IN ('facture', 'avoir', 'ticket', 'recu') AND ${dans(p)}`.execute(trx);
  return r.rows[0]!.n;
}

/** Exécute les tâches avec au plus `n` en même temps (Chromium : une page à la fois par tâche). */
async function parLots<T, R>(elements: T[], n: number, fn: (e: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = new Array(elements.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, elements.length) }, async () => {
    while (i < elements.length) {
      const k = i++;
      resultats[k] = await fn(elements[k]!);
    }
  }));
  return resultats;
}

export async function construireArchive(trx: Trx, o: { commercantId: string; periode: Periode; langue: Langue; textes: Record<string, string> }): Promise<{ zip: Uint8Array; documents: number } | { trop: true }> {
  const p = o.periode;
  const t = (cle: string) => o.textes[cle] ?? cle;
  const docs = await sql<{
    id: string; type: TypeDocument; annee: number; numero: number; emis_le: Date; acheteur_chiffre: string | null; total_ht: string; total_tva: string; timbre: string; total: string;
    mode_paiement: string | null; paye_le: Date | null; annule_par: string | null; origine_type: TypeDocument | null; origine_annee: number | null; origine_numero: number | null;
  }>`
    SELECT d.id, d.type, d.annee, d.numero, d.emis_le, d.acheteur_chiffre, d.total_ht, d.total_tva, d.timbre, d.total, d.mode_paiement, d.paye_le,
      (SELECT a.type || '|' || a.annee || '|' || a.numero FROM liens_documents l JOIN documents a ON a.id = l.cible_id WHERE l.source_id = d.id AND l.nature = 'corrige_par' LIMIT 1) AS annule_par,
      o.type AS origine_type, o.annee AS origine_annee, o.numero AS origine_numero
    FROM documents d
    LEFT JOIN liens_documents lo ON lo.cible_id = d.id AND lo.nature IN ('corrige_par', 'regle_par')
    LEFT JOIN documents o ON o.id = lo.source_id
    WHERE d.type IN ('facture', 'avoir', 'ticket', 'recu') AND ${dans(p)}
    ORDER BY d.type, d.annee, d.numero`.execute(trx);
  if (docs.rows.length > MAX_DOCUMENTS) return { trop: true };

  const nomAcheteur = (d: { id: string; acheteur_chiffre: string | null }) =>
    d.acheteur_chiffre ? (JSON.parse(dechiffrer(d.acheteur_chiffre, `documents.acheteur:${d.id}`)) as Mentions) : null;
  const numeroDe = (s: string | null) => {
    if (!s) return '';
    const [type, annee, numero] = s.split('|');
    return numeroTexte({ type: type as TypeDocument, annee: Number(annee), numero: Number(numero) });
  };
  const fichiers: Record<string, Uint8Array> = {};

  fichiers[`${t('fichierDocuments')}.csv`] = csv(
    [t('colType'), t('colNumero'), t('colDate'), t('colClient'), t('colNif'), t('colHt'), t('colTva'), t('colTimbre'), t('colTtc'), t('colPaiement'), t('colPayeLe'), t('colOrigine'), t('colAnnulePar')],
    docs.rows.map((d) => {
      const a = nomAcheteur(d);
      return [
        t(`type_${d.type}`), numeroTexte(d), dateCsv(d.emis_le), a?.nom ?? '', a?.nif ?? '',
        montantCsv(d.total_ht), montantCsv(d.total_tva), montantCsv(d.timbre), montantCsv(d.total),
        d.mode_paiement ? (t(`paiement_${d.mode_paiement}`)) : '', dateCsv(d.paye_le),
        d.origine_type ? numeroTexte({ type: d.origine_type, annee: d.origine_annee!, numero: d.origine_numero! }) : '', numeroDe(d.annule_par),
      ];
    }),
  );

  const lignes = await sql<{ type: TypeDocument; annee: number; numero: number; emis_le: Date; designation: string; quantite: number; prix_unitaire: string; taux_tva: number; total_ht: string; total_ttc: string; cout_unitaire: string }>`
    SELECT d.type, d.annee, d.numero, d.emis_le, l.designation, l.quantite, l.prix_unitaire, l.taux_tva, l.total_ht, l.total_ttc, l.cout_unitaire
    FROM lignes_document l JOIN documents d ON d.id = l.document_id
    WHERE d.type IN ('facture', 'avoir', 'ticket') AND ${dans(p)}
    ORDER BY d.type, d.annee, d.numero, l.ordre`.execute(trx);
  fichiers[`${t('fichierLignes')}.csv`] = csv(
    [t('colNumero'), t('colDate'), t('colDesignation'), t('colQuantite'), t('colPrixTtc'), t('colTauxTva'), t('colHt'), t('colTtc'), t('colCout')],
    lignes.rows.map((l) => [numeroTexte(l), dateCsv(l.emis_le), l.designation, l.quantite, montantCsv(l.prix_unitaire), (l.taux_tva / 100).toString().replace('.', ','), montantCsv(l.total_ht), montantCsv(l.total_ttc), montantCsv(Number(l.cout_unitaire) * l.quantite)]),
  );

  const stock = await sql<{ nom_fr: string; nom_ar: string; libelle: string; code_barres: string | null; quantite: number; reservee: number; prix_achat: string; prix_vente: string }>`
    SELECT p.nom_fr, p.nom_ar, v.libelle, v.code_barres, s.quantite, s.reservee, v.prix_achat, v.prix_vente
    FROM produits p JOIN variantes v ON v.produit_id = p.id AND v.archive_le IS NULL JOIN stocks s ON s.variante_id = v.id
    WHERE p.archive_le IS NULL ORDER BY p.nom_fr, p.nom_ar, v.libelle`.execute(trx);
  fichiers[`${t('fichierStock')}.csv`] = csv(
    [t('colProduit'), t('colProduitAr'), t('colVariante'), t('colCode'), t('colQuantite'), t('colReservee'), t('colPrixAchat'), t('colPrixVente'), t('colValeur')],
    stock.rows.map((s) => [s.nom_fr, s.nom_ar, s.libelle, s.code_barres ?? '', s.quantite, s.reservee, montantCsv(s.prix_achat), montantCsv(s.prix_vente), montantCsv(Number(s.prix_achat) * s.quantite)]),
  );

  const clients = await sql<{ id: string; nom: string; telephone_chiffre: string | null; factures: number; depense: string; du: string }>`
    SELECT c.id, c.nom, c.telephone_chiffre,
      (SELECT count(*) FROM documents d WHERE d.client_id = c.id AND d.type = 'facture')::int AS factures,
      coalesce((SELECT sum(s.net) FROM soldes_documents s WHERE s.client_id = c.id), 0) AS depense,
      coalesce((SELECT sum(s.net - s.paye) FROM soldes_documents s WHERE s.client_id = c.id AND (s.mode_vente IS NULL OR s.mode_vente <> 'envoi') AND s.net > s.paye), 0) AS du
    FROM clients c ORDER BY c.nom`.execute(trx);
  fichiers[`${t('fichierClients')}.csv`] = csv(
    [t('colClient'), t('colTelephone'), t('colNbFactures'), t('colDepense'), t('colDu')],
    clients.rows.map((c) => [c.nom, dechiffrerOuNul(c.telephone_chiffre, `clients.telephone:${c.id}`) ?? '', c.factures, montantCsv(c.depense), montantCsv(c.du)]),
  );

  // Un PDF par document, dans la langue choisie, rangé par type.
  const { reglages } = await mentionsVendeur(trx, o.commercantId);
  const complets = [];
  for (const d of docs.rows) complets.push((await lireDocument(trx, d.id))!);
  const pdfs = await parLots(complets, 4, (d) => enPdf(htmlDocument(d, o.langue, reglages)));
  complets.forEach((d, i) => {
    fichiers[`${t('dossierPdf')}/${t(`dossier_${d.type}`)}/${numeroTexte(d)}.pdf`] = new Uint8Array(pdfs[i]!);
  });
  return { zip: zipSync(fichiers, { level: 6, mtime: new Date() }), documents: complets.length };
}

