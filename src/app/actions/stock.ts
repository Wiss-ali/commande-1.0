'use server';
// Actions du module Stock. Chacune revérifie le droit de l'utilisateur et l'état du compte,
// puis travaille dans la transaction du commerçant (isolation par la base).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import { codeInterne } from '@/lib/codes-barres';
import { peut } from '@/lib/droits';
import { analyserMontant, analyserQuantite } from '@/lib/formats';
import { importerProduits, type BilanImport, type Colonne } from '@/lib/import-produits';
import { journaliser } from '@/lib/journal';
import { enregistrerPhoto, MAX_OCTETS_PHOTO, preparerPhoto, supprimerPhoto, type Images } from '@/lib/photos';
import {
  ajouterMouvement, annulerInventaire, archiverProduit, chercherArticles, chercherParCode, compter, creerProduit, etatVariante, modifierProduit,
  ouvrirInventaire, refusDepuisErreur, retirerLigneInventaire, trouverOuCreerCategorie, validerInventaire, type ArticleTrouve, type Contexte, type EtatStock, type SaisieVariante,
} from '@/lib/stock';
import type { SessionUtilisateur } from '@/lib/sessions';
import { MAX_LIGNES } from '@/lib/tableur';
import type { MotifMouvement } from '@/lib/types-bd';
import { exigerEcriture, exigerUtilisateur, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ctxDe = (s: SessionUtilisateur): Contexte => ({ commercantId: s.commercant.id, utilisateurId: s.utilisateur.id });

/** Exécute dans la transaction du commerçant ; une erreur connue de la base devient un message clair. */
async function chez<T>(s: SessionUtilisateur, fn: Parameters<typeof avecCommercant<T>>[1]): Promise<T | { ok: false; raison: string }> {
  try {
    return await avecCommercant(s.commercant.id, fn);
  } catch (e) {
    const raison = refusDepuisErreur(e);
    if (raison) return { ok: false, raison };
    throw e;
  }
}

const schemaVariantes = z
  .array(z.object({
    id: z.string().regex(UUID).optional(),
    libelle: z.string().max(60),
    code: z.string().max(80),
    prixAchat: z.string().max(20),
    prixVente: z.string().max(20),
    seuil: z.string().max(10),
    stock: z.string().max(10),
  }))
  .min(1)
  .max(50);

export const enregistrerProduit = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'id', 40);
  if (id && !UUID.test(id)) return { erreur: 'introuvable' };
  let brut: unknown;
  try {
    brut = JSON.parse(String(f.get('variantes') ?? ''));
  } catch {
    return { erreur: 'inconnue' };
  }
  const lu = schemaVariantes.safeParse(brut);
  if (!lu.success) return { erreur: 'inconnue' };
  const variantes: SaisieVariante[] = [];
  for (const v of lu.data) {
    const prixVente = analyserMontant(v.prixVente);
    const prixAchat = v.prixAchat.trim() ? analyserMontant(v.prixAchat) : 0;
    if (prixVente === null || prixAchat === null) return { erreur: v.prixVente.trim() ? 'montant_invalide' : 'prix_requis' };
    const seuil = v.seuil.trim() ? analyserQuantite(v.seuil) : 0;
    const stockInitial = v.stock.trim() ? analyserQuantite(v.stock) : 0;
    if (seuil === null || stockInitial === null) return { erreur: 'quantite_invalide' };
    variantes.push({ id: v.id, libelle: v.libelle, codeBarres: v.code.trim() || null, prixAchat, prixVente, seuil, stockInitial });
  }
  let images: Images | null = null;
  const photo = f.get('photo');
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_OCTETS_PHOTO) return { erreur: 'photo_invalide' };
    images = await preparerPhoto(new Uint8Array(await photo.arrayBuffer()));
    if (!images) return { erreur: 'photo_invalide' };
  }
  const ctx = ctxDe(s);
  const { ip } = await infoRequete();
  const r = await chez(s, async (trx) => {
    const nouvelle = texte(f, 'nouvelleCategorie', 60);
    const choisie = texte(f, 'categorieId', 40);
    const categorieId = nouvelle ? await trouverOuCreerCategorie(trx, ctx, nouvelle) : UUID.test(choisie) ? choisie : null;
    const saisie = { nomFr: texte(f, 'nomFr', 120), nomAr: texte(f, 'nomAr', 120), categorieId, variantes };
    let produitId = id;
    if (id) {
      const fait = await modifierProduit(trx, ctx, id, saisie);
      if (!fait.ok) return fait;
    } else {
      const fait = await creerProduit(trx, ctx, saisie);
      if (!fait.ok) return fait;
      produitId = fait.id;
    }
    if (images) await enregistrerPhoto(trx, ctx, produitId, images);
    else if (f.get('retirerPhoto') === '1') await supprimerPhoto(trx, ctx, produitId);
    await journaliser(trx, { commercantId: ctx.commercantId, acteurType: 'utilisateur', acteurId: ctx.utilisateurId, action: id ? 'produit.modifie' : 'produit.cree', objetType: 'produit', objetId: produitId, ip });
    return { ok: true as const, produitId };
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/stock', 'layout');
  redirect(`/stock/${r.produitId}`);
});

export const basculerArchive = actionSimple(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  const archiver = f.get('archiver') === '1';
  const { ip } = await infoRequete();
  const r = await chez(s, async (trx) => {
    const fait = await archiverProduit(trx, id, archiver);
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: archiver ? 'produit.archive' : 'produit.retabli', objetType: 'produit', objetId: id, ip });
    return fait;
  });
  revalidatePath('/stock', 'layout');
  if (!r.ok) redirect(`/stock/${id}?erreur=${r.raison}`);
  redirect(archiver ? '/stock' : `/stock/${id}`);
});

const MOTIFS_SORTIE: readonly MotifMouvement[] = ['casse', 'perte', 'perime', 'erreur', 'autre'];

/** Entrée de stock (tout membre de l'équipe) ou sortie hors vente (propriétaire seulement). */
export const mouvementStock = action(async (f) => {
  const sortie = f.get('sens') === 'sortie';
  const s = await exigerEcriture(sortie ? 'stock.corriger' : 'preparer', 'stock');
  const varianteId = texte(f, 'variante', 40);
  const cle = texte(f, 'cle', 40);
  const quantite = analyserQuantite(texte(f, 'quantite', 10));
  if (!UUID.test(varianteId) || !UUID.test(cle)) return { erreur: 'introuvable' };
  if (!quantite) return { erreur: 'quantite_invalide' };
  const motif = MOTIFS_SORTIE.find((m) => m === f.get('motif')) ?? 'autre';
  // Le prix d'achat n'est lu que pour le propriétaire.
  const prixSaisi = !sortie && peut(s.utilisateur.role, 'rapports') ? texte(f, 'prix', 20) : '';
  const cout = prixSaisi ? analyserMontant(prixSaisi) : undefined;
  if (cout === null) return { erreur: 'montant_invalide' };
  const r = await chez(s, async (trx) => {
    const fait = await ajouterMouvement(trx, ctxDe(s), sortie
      ? { varianteId, type: 'correction', quantite: -quantite, motif, note: texte(f, 'note', 200), cle }
      : { varianteId, type: 'entree', quantite, motif: 'achat', note: texte(f, 'note', 200), coutUnitaire: cout, cle });
    if (fait === 'ok' && cout !== undefined) await trx.updateTable('variantes').set({ prix_achat: cout }).where('id', '=', varianteId).execute();
    return { ok: true as const, fait };
  });
  if (!r.ok) return { erreur: r.raison };
  if (r.fait !== 'ok' && r.fait !== 'doublon') return { erreur: r.fait };
  revalidatePath('/stock', 'layout');
  return { ok: true };
});

/** Donne un code interne (à imprimer) à un article qui n'a pas de code-barres. */
export const donnerCodeInterne = actionSimple(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'variante', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, async (trx) => {
    for (let essai = 0; essai < 5; essai++) {
      const code = codeInterne();
      const pris = await trx.selectFrom('variantes').select('id').where('code_barres', '=', code).executeTakeFirst();
      if (pris) continue;
      await trx.updateTable('variantes').set({ code_barres: code }).where('id', '=', id).where('code_barres', 'is', null).where('archive_le', 'is', null).execute();
      return;
    }
  });
  revalidatePath('/stock', 'layout');
});

// ───────────── Scan et recherche ─────────────

export interface ArticleScan {
  varianteId: string;
  produitId: string;
  nom_fr: string;
  nom_ar: string;
  libelle: string;
  prixVente: string;
  quantite: number;
  etat: EtatStock;
}
const pourScan = (a: ArticleTrouve): ArticleScan => ({
  varianteId: a.variante_id, produitId: a.produit_id, nom_fr: a.nom_fr, nom_ar: a.nom_ar, libelle: a.libelle, prixVente: a.prix_vente, quantite: a.quantite, etat: etatVariante(a.quantite, a.seuil_alerte),
});

export async function chercherCode(code: string): Promise<ArticleScan | null> {
  const s = await exigerUtilisateur('preparer', 'stock');
  if (typeof code !== 'string' || code.length > 80) return null;
  const a = await avecCommercant(s.commercant.id, (trx) => chercherParCode(trx, code));
  return a ? pourScan(a) : null;
}

export async function chercherTexte(texteCherche: string): Promise<ArticleScan[]> {
  const s = await exigerUtilisateur('preparer', 'stock');
  if (typeof texteCherche !== 'string' || texteCherche.length > 80) return [];
  return (await avecCommercant(s.commercant.id, (trx) => chercherArticles(trx, texteCherche, 10))).map(pourScan);
}

// ───────────── Inventaire ─────────────

export const demarrerInventaire = actionSimple(async () => {
  const s = await exigerEcriture('preparer', 'stock');
  await avecCommercant(s.commercant.id, (trx) => ouvrirInventaire(trx, ctxDe(s)));
  revalidatePath('/stock/inventaire');
});

export type ResultatComptage = { ok: true; article: ArticleScan; comptee: number } | { ok: false; raison: string };

/** Compte un article de l'inventaire ouvert, désigné par son code scanné ou par son identifiant. */
export async function compterArticle(inventaireId: string, cible: { code: string } | { varianteId: string }, mode: 'ajouter' | 'fixer', n: number): Promise<ResultatComptage> {
  const s = await exigerEcriture('preparer', 'stock');
  if (!UUID.test(inventaireId) || typeof n !== 'number') return { ok: false, raison: 'introuvable' };
  const r = await chez(s, async (trx): Promise<ResultatComptage> => {
    let article: ArticleTrouve | null | undefined;
    if ('code' in cible) article = typeof cible.code === 'string' && cible.code.length <= 80 ? await chercherParCode(trx, cible.code) : null;
    else if (UUID.test(cible.varianteId)) article = (await chercherArticlesParId(trx, cible.varianteId)) ?? null;
    if (!article) return { ok: false, raison: 'code_inconnu' };
    const fait = await compter(trx, ctxDe(s), inventaireId, article.variante_id, mode === 'fixer' ? { fixer: n } : { ajouter: n });
    return fait.ok ? { ok: true, article: pourScan(article), comptee: fait.quantite } : fait;
  });
  if (r.ok) revalidatePath('/stock/inventaire');
  return r;
}

async function chercherArticlesParId(trx: Parameters<Parameters<typeof avecCommercant>[1]>[0], varianteId: string): Promise<ArticleTrouve | undefined> {
  return trx
    .selectFrom('variantes as v').innerJoin('produits as p', 'p.id', 'v.produit_id').innerJoin('stocks as s', 's.variante_id', 'v.id')
    .select(['v.id as variante_id', 'p.id as produit_id', 'p.nom_fr', 'p.nom_ar', 'v.libelle', 'v.code_barres', 'v.prix_vente', 's.quantite', 's.reservee', 'v.seuil_alerte'])
    .where('v.id', '=', varianteId).where('v.archive_le', 'is', null).executeTakeFirst();
}

export const retirerLigne = actionSimple(async (f) => {
  const s = await exigerEcriture('preparer', 'stock');
  const inventaireId = texte(f, 'inventaire', 40);
  const varianteId = texte(f, 'variante', 40);
  if (!UUID.test(inventaireId) || !UUID.test(varianteId)) return;
  await chez(s, async (trx) => {
    await retirerLigneInventaire(trx, inventaireId, varianteId);
    return { ok: true as const };
  });
  revalidatePath('/stock/inventaire');
});

export const validerInv = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'inventaire', 40);
  if (!UUID.test(id)) return { erreur: 'introuvable' };
  const { ip } = await infoRequete();
  const r = await chez(s, async (trx) => {
    const fait = await validerInventaire(trx, ctxDe(s), id);
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'inventaire.valide', objetType: 'inventaire', objetId: id, details: { corrections: fait.corrections }, ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/stock', 'layout');
  redirect(`/stock/inventaire/${id}`);
});

export const annulerInv = actionSimple(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'inventaire', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => annulerInventaire(trx, ctxDe(s), id));
  revalidatePath('/stock/inventaire');
});

// ───────────── Import ─────────────

export type ResultatImport = { ok: true; bilan: BilanImport } | { ok: false; raison: string; manquantes?: Colonne[] };

const schemaTableau = z.array(z.array(z.string().max(200)).max(30)).max(MAX_LIGNES + 1);

/** Importe un tableau lu dans le navigateur. Le serveur refait toute l'analyse : il ne se fie pas à l'aperçu. */
export async function importerTableau(lignes: unknown): Promise<ResultatImport> {
  let s: SessionUtilisateur;
  try {
    s = await exigerEcriture('stock.corriger', 'stock');
  } catch {
    return { ok: false, raison: 'interdit' };
  }
  const lu = schemaTableau.safeParse(lignes);
  if (!lu.success) return { ok: false, raison: 'fichier_illisible' };
  const { ip } = await infoRequete();
  try {
    const r = await avecCommercant(s.commercant.id, async (trx) => {
      const bilan = await importerProduits(trx, ctxDe(s), lu.data);
      if ('produits' in bilan) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'produits.importes', details: { produits: bilan.produits }, ip });
      return bilan;
    });
    if ('manquantes' in r) return { ok: false, raison: 'colonnes_manquantes', manquantes: r.manquantes };
    revalidatePath('/stock', 'layout');
    return { ok: true, bilan: r };
  } catch (e) {
    return { ok: false, raison: refusDepuisErreur(e) ?? 'inconnue' };
  }
}

