'use server';
// Actions de la caisse et des documents (factures, devis, avoirs…). Chaque action revérifie le droit
// de l'utilisateur, puis travaille dans la transaction du commerçant.
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import {
  changerEtatDevis, cloturerCaisse, creerAvoir, creerDocument, encaisserClient, encaisserFacture, fixerFondCaisse, lireDocument, modifierDevis, numeroTexte, prixPermis,
  traiterEcart, transformer, vendreEnCaisse, type Encaissement, type LigneSaisie, type Mentions, type RetourLigne,
} from '@/lib/documents';
import { peutRemiser } from '@/lib/droits';
import { commandeDuDocument } from '@/lib/commandes';
import { analyserTaux, schemaReglagesDocuments } from '@/lib/fiscal';
import { analyserMontant, analyserQuantite } from '@/lib/formats';
import { journaliser } from '@/lib/journal';
import type { SessionUtilisateur } from '@/lib/sessions';
import { refusDepuisErreur, type Contexte } from '@/lib/stock';
import { MODES_ENCAISSEMENT, type ModeEncaissement, type TypeDocument } from '@/lib/types-bd';
import { exigerEcriture, infoRequete, Interdit } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ctxDe = (s: SessionUtilisateur): Contexte => ({ commercantId: s.commercant.id, utilisateurId: s.utilisateur.id });

const schemaAcheteur = z.object({
  nom: z.string().max(120), telephone: z.string().max(30).optional(), adresse: z.string().max(300).optional(),
  rc: z.string().max(40).optional(), nif: z.string().max(40).optional(), nis: z.string().max(40).optional(), ai: z.string().max(40).optional(),
});
const montant = z.number().int().min(0).max(100_000_000_00);
const schemaVente = z.object({
  lignes: z.array(z.object({ varianteId: z.string().regex(UUID), quantite: z.number().int().min(1).max(100_000), remise: montant.optional() })).min(1).max(200),
  facture: z.boolean(),
  acheteur: schemaAcheteur.nullable().optional(),
  cle: z.string().regex(UUID),
  remiseGlobale: montant.optional(),
  // Absent : tout en espèces (ventes gardées dans le téléphone avant cette version comprises).
  encaisse: z.array(z.object({ mode: z.enum(MODES_ENCAISSEMENT as [ModeEncaissement, ...ModeEncaissement[]]), montant: montant, reference: z.string().max(60).optional() })).max(5).optional(),
});
const modeDe = (v: FormDataEntryValue | null): ModeEncaissement => MODES_ENCAISSEMENT.find((m) => m === v) ?? 'especes';

export type ResultatVente = { ok: true; id: string; numero: string; total: number; manques: number } | { ok: false; raison: string };

/** Vente en caisse. Appelée par le téléphone, y compris pour une vente gardée pendant une coupure. */
export async function vendre(vente: unknown): Promise<ResultatVente> {
  try {
    const s = await exigerEcriture('vendre', 'caisse');
    const lu = schemaVente.safeParse(vente);
    if (!lu.success) return { ok: false, raison: 'panier_vide' };
    // Remise : revérifiée ici, même pour une vente gardée dans le téléphone pendant une coupure.
    if ((lu.data.remiseGlobale || lu.data.lignes.some((l) => l.remise)) && !peutRemiser(s.utilisateur)) return { ok: false, raison: 'interdit' };
    const r = await avecCommercant(s.commercant.id, async (trx) => {
      const fait = await vendreEnCaisse(trx, ctxDe(s), lu.data);
      if (!fait.ok) return fait;
      const d = (await lireDocument(trx, fait.id))!;
      return { ok: true as const, id: fait.id, numero: numeroTexte(d), total: d.total, manques: fait.manques };
    });
    if (r.ok) revalidatePath('/', 'layout');
    return r;
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Interdit) return { ok: false, raison: 'interdit' };
    // Deux envois de la même vente au même instant : le second est refusé par la base, le premier a réussi.
    throw e;
  }
}

function acheteurDe(f: FormData): Mentions | null {
  const a = { nom: texte(f, 'clientNom', 120), telephone: texte(f, 'clientTelephone', 30), adresse: texte(f, 'clientAdresse', 300), rc: texte(f, 'clientRc', 40), nif: texte(f, 'clientNif', 40), nis: texte(f, 'clientNis', 40), ai: texte(f, 'clientAi', 40) };
  return Object.values(a).some(Boolean) ? a : null;
}

const schemaLignes = z.array(z.object({ varianteId: z.string().regex(UUID).nullable(), designation: z.string().max(200), quantite: z.string().max(10), prix: z.string().max(20), remise: z.string().max(20).optional() })).min(1).max(200);
const TYPES_MANUELS: readonly TypeDocument[] = ['devis', 'proforma', 'bon_commande'];

/** Crée un devis, une proforma ou un bon de commande écrits à la main, ou modifie un devis en attente. */
export const enregistrerDocument = action(async (f) => {
  const s = await exigerEcriture('vendre', 'factures');
  const id = texte(f, 'id', 40);
  const type = TYPES_MANUELS.find((t) => t === f.get('type')) ?? 'devis';
  let brut: unknown;
  try {
    brut = JSON.parse(String(f.get('lignes') ?? ''));
  } catch {
    return { erreur: 'panier_vide' };
  }
  const lu = schemaLignes.safeParse(brut);
  if (!lu.success) return { erreur: 'panier_vide' };
  const lignes: LigneSaisie[] = [];
  for (const l of lu.data) {
    const quantite = analyserQuantite(l.quantite);
    const prixUnitaire = analyserMontant(l.prix);
    if (!quantite) return { erreur: 'quantite_invalide' };
    if (prixUnitaire === null) return { erreur: 'montant_invalide' };
    const remise = l.remise?.trim() ? analyserMontant(l.remise) : 0;
    if (remise === null) return { erreur: 'remise_invalide' };
    lignes.push({ varianteId: l.varianteId, designation: l.designation, quantite, prixUnitaire, remise });
  }
  const remiseGlobale = texte(f, 'remiseGlobale', 20) ? analyserMontant(texte(f, 'remiseGlobale', 20)) : 0;
  if (remiseGlobale === null) return { erreur: 'remise_invalide' };
  const acheteur = acheteurDe(f);
  const note = texte(f, 'note', 500);
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    if (id && !UUID.test(id)) return { ok: false as const, raison: 'introuvable' };
    // Sans la permission « remises » (accordée par le propriétaire), un vendeur garde le prix de la fiche et ne fait
    // pas de remise : sinon un devis à prix cassé, transformé en facture, contournerait l'interdiction de la caisse.
    // En modifiant un devis existant, il peut garder les prix et remises déjà écrits par quelqu'un d'autre.
    if (!peutRemiser(s.utilisateur) && !(await prixPermis(trx, lignes, remiseGlobale, id || null))) return { ok: false as const, raison: 'prix_interdit' };
    if (id) {
      const fait = await modifierDevis(trx, ctxDe(s), id, { lignes, acheteur, note, remiseGlobale });
      return fait.ok ? { ok: true as const, id } : fait;
    }
    return creerDocument(trx, ctxDe(s), { type, origine: 'manuel', lignes, acheteur, note, remiseGlobale, prixLibres: true, cle: UUID.test(texte(f, 'cle', 40)) ? texte(f, 'cle', 40) : undefined });
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/factures', 'layout');
  redirect(`/factures/${r.id}`);
});

const CIBLES: readonly TypeDocument[] = ['facture', 'bon_livraison', 'proforma', 'bon_commande'];

/** Transforme un document en suivant. Pour une facture, `mode` répond à « Envoi » ou « Vente directe ». */
export const transformerDocument = action(async (f) => {
  const s = await exigerEcriture('vendre', 'factures');
  const id = texte(f, 'id', 40);
  const cle = texte(f, 'cle', 40);
  const cible = CIBLES.find((c) => c === f.get('cible'));
  if (!UUID.test(id) || !UUID.test(cle) || !cible) return { erreur: 'introuvable' };
  const mode = f.get('mode') === 'envoi' ? 'envoi' : f.get('mode') === 'directe' ? 'directe' : undefined;
  const acheteur = acheteurDe(f);
  // Vente directe : payée tout de suite par le moyen choisi, ou laissée à payer (vente à crédit).
  const paiement = f.get('paiement');
  const encaisse: Encaissement[] | undefined = mode !== 'directe' || !paiement ? undefined : paiement === 'credit' ? [] : undefined;
  const modePaiement = paiement && paiement !== 'credit' ? modeDe(paiement) : 'especes';
  let r;
  try {
    r = await avecCommercant(s.commercant.id, async (trx) => {
      if (mode === 'directe' && paiement && paiement !== 'credit' && modePaiement !== 'especes') {
        // Le total n'est connu qu'avec les lignes du document d'origine : la somme reçue est ce total.
        const source = await lireDocument(trx, id);
        if (!source) return { ok: false as const, raison: 'introuvable' as const };
        const total = source.lignes.reduce((t, l) => t + l.totalTtc, 0);
        return transformer(trx, ctxDe(s), id, cible, { mode, acheteur: acheteur ?? undefined, cle, encaisse: [{ mode: modePaiement, montant: total, reference: texte(f, 'reference', 60) }] });
      }
      return transformer(trx, ctxDe(s), id, cible, { mode, acheteur: acheteur ?? undefined, cle, encaisse });
    });
  } catch (e) {
    const raison = refusDepuisErreur(e);
    if (!raison) throw e;
    return { erreur: raison };
  }
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect(`/factures/${r.id}${r.manques ? '?manques=1' : ''}`);
});

/**
 * Annule une facture ou un ticket par un avoir, ou n'en rend qu'une partie (« retour de N articles »).
 * Réservé au propriétaire : c'est un remboursement.
 */
export const annulerDocument = action(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'factures');
  const id = texte(f, 'id', 40);
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(id) || !UUID.test(cle)) return { erreur: 'introuvable' };
  // Retour partiel : une quantité par ligne (champs « retour.<id de ligne> »). Sans ces champs : tout.
  let lignes: RetourLigne[] | undefined;
  if (f.get('partiel') === '1') {
    lignes = [];
    for (const [nom, valeur] of f.entries()) {
      if (!nom.startsWith('retour.')) continue;
      const ligneId = nom.slice(7);
      const q = String(valeur).trim();
      if (!q || q === '0') continue;
      const n = analyserQuantite(q);
      if (!UUID.test(ligneId) || !n) return { erreur: 'retour_invalide' };
      lignes.push({ ligneId, quantite: n });
    }
    if (!lignes.length || lignes.length > 200) return { erreur: 'retour_invalide' };
  }
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    // La facture d'une commande s'annule depuis la commande (annulation ou retour du colis).
    if (await commandeDuDocument(trx, id)) return { ok: false as const, raison: 'transformation_impossible' };
    const fait = await creerAvoir(trx, ctxDe(s), id, { remettreEnStock: f.get('remettre') === 'on', cle, lignes, modeRemboursement: modeDe(f.get('modeRemboursement')) });
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: lignes ? 'document.retour_partiel' : 'document.annule', objetType: 'document', objetId: id, details: { rembourse: fait.rembourse }, ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect(`/factures/${r.id}`);
});

export const encaisser = action(async (f) => {
  const s = await exigerEcriture('vendre', 'factures');
  const id = texte(f, 'id', 40);
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(id) || !UUID.test(cle)) return { erreur: 'introuvable' };
  const brut = texte(f, 'montant', 20);
  const montantRecu = brut ? analyserMontant(brut) : undefined;
  if (montantRecu === null) return { erreur: 'montant_invalide' };
  const p = { mode: modeDe(f.get('mode')), montant: montantRecu, reference: texte(f, 'reference', 60) };
  const r = await avecCommercant(s.commercant.id, async (trx) => ((await commandeDuDocument(trx, id)) ? { ok: false as const, raison: 'transformation_impossible' } : encaisserFacture(trx, ctxDe(s), id, cle, p)));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect(`/factures/${r.id}`);
});

/** Versement d'un client sur son crédit : il règle ses ventes dues, des plus anciennes aux plus récentes. */
export const encaisserCredit = action(async (f) => {
  const s = await exigerEcriture('vendre', 'clients');
  const clientId = texte(f, 'client', 40);
  const cle = texte(f, 'cle', 40);
  const montantRecu = analyserMontant(texte(f, 'montant', 20));
  if (!UUID.test(clientId) || !UUID.test(cle)) return { erreur: 'introuvable' };
  if (!montantRecu) return { erreur: 'montant_invalide' };
  const r = await avecCommercant(s.commercant.id, (trx) => encaisserClient(trx, ctxDe(s), clientId, { mode: modeDe(f.get('mode')), montant: montantRecu, reference: texte(f, 'reference', 60), cle }));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  // La confirmation s'affiche en haut de la fiche (la carte du crédit disparaît quand tout est payé).
  redirect(`/clients/${clientId}?verse=${r.recus.length}`);
});

export const changerEtat = actionSimple(async (f) => {
  const s = await exigerEcriture('vendre', 'factures');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => changerEtatDevis(trx, ctxDe(s), id, f.get('etat') === 'en_attente' ? 'en_attente' : 'refuse'));
  revalidatePath('/factures', 'layout');
});

// ───────────── Caisse ─────────────

export const definirFond = action(async (f) => {
  const s = await exigerEcriture('vendre', 'caisse');
  const fond = analyserMontant(texte(f, 'fond', 20));
  if (fond === null) return { erreur: 'montant_invalide' };
  const r = await avecCommercant(s.commercant.id, (trx) => fixerFondCaisse(trx, ctxDe(s), fond));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/caisse', 'layout');
  return { ok: true };
});

export const cloturer = action(async (f) => {
  const s = await exigerEcriture('vendre', 'caisse');
  const comptees = analyserMontant(texte(f, 'comptees', 20));
  if (comptees === null) return { erreur: 'montant_invalide' };
  const { ip } = await infoRequete();
  const r = await avecCommercant(s.commercant.id, async (trx) => {
    const fait = await cloturerCaisse(trx, ctxDe(s), { comptees, note: texte(f, 'note', 200) });
    if (fait.ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'caisse.cloturee', objetType: 'caisse', objetId: fait.id, details: { ecart: fait.ecart }, ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/caisse', 'layout');
  redirect(`/caisse/cloture/${r.id}`);
});

export const marquerEcart = actionSimple(async (f) => {
  const s = await exigerEcriture('stock.corriger', 'stock');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => traiterEcart(trx, ctxDe(s), id));
  revalidatePath('/stock', 'layout');
});

// ───────────── Réglages de facturation du commerçant ─────────────

export const enregistrerFacturation = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const assujetti = f.get('assujettiTva') === 'on';
  const taux = texte(f, 'tauxDefaut', 10) ? analyserTaux(texte(f, 'tauxDefaut', 10)) : 0;
  if (taux === null) return { erreur: 'taux_invalide' };
  const validite = analyserQuantite(texte(f, 'validiteDevisJours', 5) || '30');
  const lu = schemaReglagesDocuments.safeParse({
    assujettiTva: assujetti, tauxDefaut: assujetti ? taux : 0, mentionSansTva: texte(f, 'mentionSansTva', 200),
    timbreFactures: f.get('timbreFactures') === 'on', timbreTickets: f.get('timbreTickets') === 'on',
    piedDePage: texte(f, 'piedDePage', 300), validiteDevisJours: validite ?? 0,
  });
  if (!lu.success) return { erreur: 'quantite_invalide' };
  const { ip } = await infoRequete();
  await avecCommercant(s.commercant.id, async (trx) => {
    await trx.updateTable('commercants').set({ reglages_documents: JSON.stringify(lu.data) }).execute();
    await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'facturation.modifiee', details: { assujettiTva: lu.data.assujettiTva, tauxDefaut: lu.data.tauxDefaut, timbreFactures: lu.data.timbreFactures, timbreTickets: lu.data.timbreTickets }, ip });
  });
  revalidatePath('/reglages/facturation');
  return { ok: true };
});
