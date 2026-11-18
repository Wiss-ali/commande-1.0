'use server';
// Actions des fournisseurs et arrivages (propriétaire), des dépenses (caisse) et des versements du transporteur.
// Chaque action revérifie le droit et le module, puis travaille dans la transaction du commerçant.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import { annulerDepense, creerDepense, enregistrerVersement } from '@/lib/depenses';
import { archiverFournisseur, creerArrivage, enregistrerFournisseur, payerFournisseur } from '@/lib/fournisseurs';
import { analyserMontant } from '@/lib/formats';
import { journaliser } from '@/lib/journal';
import type { SessionUtilisateur } from '@/lib/sessions';
import { chercherArticles, refusDepuisErreur, type Contexte } from '@/lib/stock';
import { CATEGORIES_DEPENSE, MODES_ENCAISSEMENT, type CategorieDepense, type ModeEncaissement } from '@/lib/types-bd';
import { exigerEcriture, exigerUtilisateur, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ctxDe = (s: SessionUtilisateur): Contexte => ({ commercantId: s.commercant.id, utilisateurId: s.utilisateur.id });
const modeDe = (v: FormDataEntryValue | null): ModeEncaissement => MODES_ENCAISSEMENT.find((m) => m === v) ?? 'especes';
const journal = (s: SessionUtilisateur, action: string, objet?: { type: string; id: string }, details?: Record<string, string | number | boolean | null>) => async (trx: Parameters<typeof journaliser>[0]) => {
  const { ip } = await infoRequete();
  await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action, objetType: objet?.type, objetId: objet?.id, details, ip });
};

// ───────────── Fournisseurs ─────────────

export const enregistrerFournisseurAction = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'id', 40);
  if (id && !UUID.test(id)) return { erreur: 'introuvable' };
  const r = await avecCommercant(s.commercant.id, (trx) => enregistrerFournisseur(trx, ctxDe(s), { id: id || undefined, nom: texte(f, 'nom', 120), telephone: texte(f, 'telephone', 30), note: texte(f, 'note', 300) }));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/stock/fournisseurs', 'layout');
  if (!id) redirect(`/stock/fournisseurs/${r.id}`);
  return { ok: true };
});

export const archiverFournisseurAction = actionSimple(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => archiverFournisseur(trx, id, f.get('archiver') === '1'));
  revalidatePath('/stock/fournisseurs', 'layout');
});

export const payerFournisseurAction = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'fournisseur', 40);
  const cle = texte(f, 'cle', 40);
  const montant = analyserMontant(texte(f, 'montant', 20));
  if (!UUID.test(id) || !UUID.test(cle)) return { erreur: 'introuvable' };
  if (!montant) return { erreur: 'montant_invalide' };
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await payerFournisseur(trx, ctxDe(s), id, { montant, mode: modeDe(f.get('mode')), reference: texte(f, 'reference', 60), cle });
    if (fait.ok) await journal(s, 'fournisseur.paye', { type: 'fournisseur', id }, { montant })(trx);
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  return { ok: true };
});

/** Recherche d'un article pour un arrivage : avec son prix d'achat actuel (propriétaire seulement). */
export async function chercherPourArrivage(texteCherche: string): Promise<{ varianteId: string; nom_fr: string; nom_ar: string; libelle: string; prixAchat: number; quantite: number }[]> {
  const s = await exigerUtilisateur('stock.corriger', 'stock');
  if (typeof texteCherche !== 'string' || texteCherche.length > 80 || !texteCherche.trim()) return [];
  return avecCommercant(s.commercant.id, async (trx) => {
    const trouves = await chercherArticles(trx, texteCherche, 10);
    if (!trouves.length) return [];
    const prix = await trx.selectFrom('variantes').select(['id', 'prix_achat']).where('id', 'in', trouves.map((a) => a.variante_id)).execute();
    const parId = new Map(prix.map((p) => [p.id, Number(p.prix_achat)]));
    return trouves.map((a) => ({ varianteId: a.variante_id, nom_fr: a.nom_fr, nom_ar: a.nom_ar, libelle: a.libelle, prixAchat: parId.get(a.variante_id) ?? 0, quantite: a.quantite }));
  });
}

const schemaLignesArrivage = z.array(z.object({ varianteId: z.string().regex(UUID), quantite: z.string().max(10), cout: z.string().max(20) })).min(1).max(200);

export const enregistrerArrivage = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const cle = texte(f, 'cle', 40);
  const fournisseurId = texte(f, 'fournisseur', 40);
  if (!UUID.test(cle) || (fournisseurId && !UUID.test(fournisseurId))) return { erreur: 'introuvable' };
  let brut: unknown;
  try {
    brut = JSON.parse(String(f.get('lignes') ?? ''));
  } catch {
    return { erreur: 'panier_vide' };
  }
  const lu = schemaLignesArrivage.safeParse(brut);
  if (!lu.success) return { erreur: 'panier_vide' };
  const lignes: { varianteId: string; quantite: number; coutUnitaire: number }[] = [];
  for (const l of lu.data) {
    const quantite = Number(l.quantite.trim());
    const cout = analyserMontant(l.cout);
    if (!Number.isInteger(quantite) || quantite < 1) return { erreur: 'quantite_invalide' };
    if (cout === null) return { erreur: 'montant_invalide' };
    lignes.push({ varianteId: l.varianteId, quantite, coutUnitaire: cout });
  }
  const payeTexte = texte(f, 'paye', 20);
  const paye = payeTexte ? analyserMontant(payeTexte) : 0;
  if (paye === null) return { erreur: 'montant_invalide' };
  let r;
  try {
    r = await avecCommercant(s.commercant.id, async (trx) => {
      const fait = await creerArrivage(trx, ctxDe(s), {
        fournisseurId: fournisseurId || null, reference: texte(f, 'reference', 60), recuLe: texte(f, 'recuLe', 10), lignes, note: texte(f, 'note', 300),
        paye: paye ? { montant: paye, mode: modeDe(f.get('mode')), reference: texte(f, 'referencePaiement', 60) } : null, cle,
      });
      if (fait.ok && !fait.doublon) await journal(s, 'arrivage.cree', { type: 'arrivage', id: fait.id })(trx);
      return fait;
    });
  } catch (e) {
    const raison = refusDepuisErreur(e);
    if (!raison) throw e;
    return { erreur: raison };
  }
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect(`/stock/arrivages/${r.id}`);
});

// ───────────── Dépenses ─────────────

export const enregistrerDepense = action(async (f) => {
  const s = await exigerEcriture('vendre', 'caisse');
  const cle = texte(f, 'cle', 40);
  const montant = analyserMontant(texte(f, 'montant', 20));
  if (!UUID.test(cle)) return { erreur: 'introuvable' };
  if (!montant) return { erreur: 'montant_invalide' };
  const categorie = CATEGORIES_DEPENSE.find((c) => c === f.get('categorie')) as CategorieDepense | undefined;
  if (!categorie) return { erreur: 'categorie_invalide' };
  const mode = modeDe(f.get('mode'));
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await creerDepense(trx, ctxDe(s), { categorie, libelle: texte(f, 'libelle', 120), montant, depenseLe: texte(f, 'depenseLe', 10), mode, parCaisse: mode === 'especes' && f.get('parCaisse') === 'on', cle });
    if (fait.ok) await journal(s, 'depense.creee', { type: 'depense', id: fait.id }, { montant, categorie })(trx);
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  return { ok: true };
});

export const annulerDepenseAction = action(async (f) => {
  const s = await exigerEcriture('vendre', 'caisse');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'introuvable' };
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    // Un vendeur n'annule que ses propres dépenses ; le propriétaire, toutes.
    if (s.utilisateur.role !== 'proprietaire') {
      const d = await trx.selectFrom('depenses').select('cree_par').where('id', '=', id).executeTakeFirst();
      if (!d || d.cree_par !== s.utilisateur.id) return { ok: false as const, raison: 'interdit' as const };
    }
    const fait = await annulerDepense(trx, ctxDe(s), id);
    if (fait.ok) await journal(s, 'depense.annulee', { type: 'depense', id })(trx);
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  return { ok: true };
});

// ───────────── Versements du transporteur ─────────────

export const enregistrerVersementAction = action(async (f) => {
  const s = await exigerEcriture('vendre', 'commandes');
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(cle)) return { erreur: 'introuvable' };
  const commandes = f.getAll('commande').map(String).filter((c) => UUID.test(c));
  const recu = analyserMontant(texte(f, 'recu', 20));
  if (recu === null) return { erreur: 'montant_invalide' };
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await enregistrerVersement(trx, ctxDe(s), { commandes, recu, mode: modeDe(f.get('mode')), reference: texte(f, 'reference', 60), recuLe: texte(f, 'recuLe', 10), note: texte(f, 'note', 300), cle });
    if (fait.ok) await journal(s, 'versement.enregistre', { type: 'versement', id: fait.id }, { colis: commandes.length, recu })(trx);
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  // Confirmation en haut de la page : le formulaire disparaît quand il ne reste plus de colis à reverser.
  redirect('/commandes/versements?fait=1');
});
