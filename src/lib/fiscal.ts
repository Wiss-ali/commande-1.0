// Calculs de facturation : TVA et droit de timbre. Aucun taux n'est écrit ici : tout vient des réglages
// (du commerçant pour la TVA, de l'administrateur pour le barème du timbre).
import { z } from 'zod';

/** Réglages de facturation d'un commerçant (colonne commercants.reglages_documents). */
export const schemaReglagesDocuments = z.object({
  /** Le commerçant facture-t-il la TVA ? Sinon aucune TVA n'apparaît, et la mention ci-dessous est imprimée. */
  assujettiTva: z.boolean().default(false),
  /** Taux par défaut, en centièmes de pour cent (1900 = 19 %). Chaque produit peut avoir le sien. */
  tauxDefaut: z.number().int().min(0).max(10000).default(0),
  mentionSansTva: z.string().max(200).default(''),
  timbreFactures: z.boolean().default(false),
  timbreTickets: z.boolean().default(false),
  /** Texte libre en bas des documents (conditions, remerciement…). */
  piedDePage: z.string().max(300).default(''),
  validiteDevisJours: z.number().int().min(1).max(365).default(30),
});
export type ReglagesDocuments = z.infer<typeof schemaReglagesDocuments>;

export function lireReglagesDocuments(brut: unknown): ReglagesDocuments {
  const r = schemaReglagesDocuments.safeParse(brut ?? {});
  return r.success ? r.data : schemaReglagesDocuments.parse({});
}

/**
 * Barème du droit de timbre, saisi par l'administrateur. Montants en centimes.
 * Chaque tranche : jusqu'à quel total elle s'applique (null = sans limite) et combien par tranche de 100 DA.
 */
export const schemaBaremeTimbre = z.object({
  exonereJusqua: z.number().int().min(0).default(0),
  tranches: z.array(z.object({ jusqua: z.number().int().positive().nullable(), parCent: z.number().int().min(0) })).max(10).default([]),
  minimum: z.number().int().min(0).default(0),
  plafond: z.number().int().positive().nullable().default(null),
});
export type BaremeTimbre = z.infer<typeof schemaBaremeTimbre>;

export function lireBaremeTimbre(brut: unknown): BaremeTimbre {
  const r = schemaBaremeTimbre.safeParse(brut ?? {});
  return r.success ? r.data : schemaBaremeTimbre.parse({});
}

/** Droit de timbre dû pour un total TTC payé en espèces. Zéro tant que le barème est vide. */
export function calculerTimbre(totalTtc: number, bareme: BaremeTimbre): number {
  if (totalTtc <= 0 || !bareme.tranches.length || totalTtc <= bareme.exonereJusqua) return 0;
  const tranche = bareme.tranches.find((t) => t.jusqua === null || totalTtc <= t.jusqua) ?? bareme.tranches[bareme.tranches.length - 1]!;
  // Toute tranche de 100 DA commencée est due.
  let timbre = Math.ceil(totalTtc / 10_000) * tranche.parCent;
  timbre = Math.max(timbre, bareme.minimum);
  if (bareme.plafond !== null) timbre = Math.min(timbre, bareme.plafond);
  return timbre;
}

export interface LigneCalculee {
  totalTtc: number;
  totalHt: number;
}

/** Hors taxe d'un montant TTC, arrondi au centime. */
export const horsTaxe = (ttc: number, tauxTva: number) => (tauxTva ? Math.round((ttc * 10_000) / (10_000 + tauxTva)) : ttc);

/** Une ligne : le prix unitaire est TTC ; la remise (TTC) se retire du total ; le hors taxe s'en déduit. */
export function calculerLigne(prixUnitaireTtc: number, quantite: number, tauxTva: number, remise = 0): LigneCalculee {
  const totalTtc = prixUnitaireTtc * quantite - remise;
  return { totalTtc, totalHt: horsTaxe(totalTtc, tauxTva) };
}

/**
 * Répartit une remise sur le total entre les lignes, au prorata de leur montant (au centime près, sans perte) :
 * chaque ligne garde ainsi sa TVA juste. Renvoie la part de chaque ligne.
 */
export function repartirRemise(montants: number[], remise: number): number[] {
  const total = montants.reduce((s, m) => s + m, 0);
  if (remise <= 0 || total <= 0) return montants.map(() => 0);
  remise = Math.min(remise, total);
  const parts = montants.map((m) => Math.floor((m * remise) / total));
  let reste = remise - parts.reduce((s, p) => s + p, 0);
  // Les centimes restants vont aux lignes dont la part arrondie a perdu le plus (méthode du plus grand reste).
  const ordre = montants.map((m, i) => i).sort((a, b) => ((montants[b]! * remise) % total) - ((montants[a]! * remise) % total) || montants[b]! - montants[a]!);
  for (let k = 0; reste > 0; k = (k + 1) % ordre.length) {
    const i = ordre[k]!;
    if (parts[i]! < montants[i]!) { parts[i]!++; reste--; }
  }
  return parts;
}

/** Prix unitaire hors taxe affiché sur la facture. */
export const prixHorsTaxe = (prixUnitaireTtc: number, tauxTva: number) => (tauxTva ? Math.round((prixUnitaireTtc * 10_000) / (10_000 + tauxTva)) : prixUnitaireTtc);

/** « 1900 » → « 19 % », « 950 » → « 9,5 % ». */
export const formaterTaux = (taux: number) => `${String(taux / 100).replace('.', ',')} %`;

/** Saisie « 19 » ou « 9,5 » → centièmes de pour cent, ou null. */
export function analyserTaux(saisie: string): number | null {
  const t = saisie.trim().replace('%', '').replace(',', '.').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return n <= 10_000 ? n : null;
}
