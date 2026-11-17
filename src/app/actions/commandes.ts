'use server';
// Actions des commandes à livrer, des clients et des réglages de livraison.
// Chaque action revérifie le droit et le module côté serveur, puis travaille dans la transaction du commerçant.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { action, actionSimple, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import {
  activerTransporteur, ajouterTransporteur, alerteTelephone, annulerCommande, confirmerCommande, creerCommande, enregistrerFrais, expedier, fraisPour,
  marquerLivree, marquerPreparee, marquerRetournee, noterAppel, type Alerte, type Frais,
} from '@/lib/commandes';
import { analyserMontant } from '@/lib/formats';
import { journaliser } from '@/lib/journal';
import type { SessionUtilisateur } from '@/lib/sessions';
import { refusDepuisErreur, type Contexte } from '@/lib/stock';
import type { ModeLivraison } from '@/lib/types-bd';
import { exigerEcriture, exigerUtilisateur, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ctxDe = (s: SessionUtilisateur): Contexte => ({ commercantId: s.commercant.id, utilisateurId: s.utilisateur.id });
const livraisonDe = (v: unknown): ModeLivraison => (v === 'point_relais' ? 'point_relais' : 'domicile');

const schemaLignes = z.array(z.object({ varianteId: z.string().regex(UUID), quantite: z.number().int().min(1).max(100_000) })).min(1).max(100);

/** Commande saisie à la main. Les frais viennent de la grille, sauf si le vendeur les a changés. */
export const nouvelleCommande = action(async (f) => {
  const s = await exigerEcriture('vendre', 'commandes');
  let brut: unknown;
  try {
    brut = JSON.parse(String(f.get('lignes') ?? ''));
  } catch {
    return { erreur: 'panier_vide' };
  }
  const lignes = schemaLignes.safeParse(brut);
  if (!lignes.success) return { erreur: 'panier_vide' };
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(cle)) return { erreur: 'inconnue' };
  const fraisSaisis = texte(f, 'frais', 20);
  const frais = fraisSaisis ? analyserMontant(fraisSaisis) : null;
  if (fraisSaisis && frais === null) return { erreur: 'montant_invalide' };
  const t = await getTranslations({ locale: s.utilisateur.langue, namespace: 'commandes' });
  let r;
  try {
    r = await avecCommercant(s.commercant.id, (trx) =>
      creerCommande(trx, ctxDe(s), {
        client: { nom: texte(f, 'nom', 120), telephone: texte(f, 'telephone', 30) },
        wilaya: Number(texte(f, 'wilaya', 3)) || 0,
        commune: texte(f, 'commune', 80),
        livraison: livraisonDe(f.get('livraison')),
        adresse: texte(f, 'adresse', 200),
        lignes: lignes.data,
        frais,
        note: texte(f, 'note', 500),
        cle,
        libelleLivraison: t('libelleLivraison'),
      }),
    );
  } catch (e) {
    const raison = refusDepuisErreur(e);
    if (!raison) throw e;
    return { erreur: raison };
  }
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  redirect(`/commandes/${r.id}`);
});

/** Pendant la saisie : frais de la wilaya et alerte si ce numéro a déjà des retours. */
export async function infosSaisie(wilaya: number, livraison: string, telephone: string): Promise<{ frais: number | null; alerte: Alerte | null }> {
  const s = await exigerUtilisateur('vendre', 'commandes');
  if (!Number.isInteger(wilaya) || typeof telephone !== 'string' || telephone.length > 30) return { frais: null, alerte: null };
  return avecCommercant(s.commercant.id, async (trx) => ({
    frais: wilaya ? await fraisPour(trx, wilaya, livraisonDe(livraison)) : null,
    alerte: telephone.trim() ? await alerteTelephone(trx, telephone) : null,
  }));
}

type Operation = 'appel' | 'confirmer_envoi' | 'confirmer_directe' | 'preparer' | 'expedier' | 'livrer' | 'retour' | 'annuler';
const OPERATIONS: readonly Operation[] = ['appel', 'confirmer_envoi', 'confirmer_directe', 'preparer', 'expedier', 'livrer', 'retour', 'annuler'];

/** Un bouton de la fiche commande. Le préparateur ne peut que préparer et expédier. */
export const agirCommande = action(async (f) => {
  const op = OPERATIONS.find((o) => o === f.get('op'));
  if (!op) return { erreur: 'introuvable' };
  const s = await exigerEcriture(op === 'preparer' || op === 'expedier' ? 'preparer' : 'vendre', 'commandes');
  const id = texte(f, 'id', 40);
  const cle = texte(f, 'cle', 40);
  if (!UUID.test(id) || !UUID.test(cle)) return { erreur: 'introuvable' };
  const ctx = ctxDe(s);
  const { ip } = await infoRequete();
  let r;
  try {
    r = await avecCommercant(s.commercant.id, async (trx) => {
      const fait =
        op === 'appel' ? await noterAppel(trx, ctx, id)
        : op === 'confirmer_envoi' ? await confirmerCommande(trx, ctx, id, 'envoi', cle)
        : op === 'confirmer_directe' ? await confirmerCommande(trx, ctx, id, 'directe', cle)
        : op === 'preparer' ? await marquerPreparee(trx, ctx, id)
        : op === 'expedier' ? await expedier(trx, ctx, id, { transporteurId: UUID.test(texte(f, 'transporteur', 40)) ? texte(f, 'transporteur', 40) : null, numeroSuivi: texte(f, 'suivi', 60) })
        : op === 'livrer' ? await marquerLivree(trx, ctx, id)
        : op === 'retour' ? await marquerRetournee(trx, ctx, id, cle)
        : await annulerCommande(trx, ctx, id, cle);
      if (fait.ok && (op === 'retour' || op === 'annuler')) {
        await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: `commande.${op}`, objetType: 'commande', objetId: id, ip });
      }
      return fait;
    });
  } catch (e) {
    const raison = refusDepuisErreur(e);
    if (!raison) throw e;
    return { erreur: raison };
  }
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/', 'layout');
  return { ok: true };
});

// ───────────── Réglages › Livraison ─────────────

export const nouveauTransporteur = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const r = await avecCommercant(s.commercant.id, (trx) => ajouterTransporteur(trx, ctxDe(s), texte(f, 'nom', 60)));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/reglages/livraison');
  return { ok: true };
});

export const basculerTransporteur = actionSimple(async (f) => {
  const s = await exigerEcriture('reglages');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  await avecCommercant(s.commercant.id, (trx) => activerTransporteur(trx, id, f.get('actif') === 'oui'));
  revalidatePath('/reglages/livraison');
});

/** Grille des frais : un champ « domicile_<code> » et « relais_<code> » par wilaya. Vide : non proposé. */
export const enregistrerGrille = action(async (f) => {
  const s = await exigerEcriture('reglages');
  const grille: Frais[] = [];
  for (let code = 1; code <= 99; code++) {
    const d = f.get(`domicile_${code}`);
    const p = f.get(`relais_${code}`);
    if (d === null && p === null) continue;
    const lire = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.trim() ? analyserMontant(v) : null);
    const domicile = lire(d);
    const pointRelais = lire(p);
    if ((typeof d === 'string' && d.trim() && domicile === null) || (typeof p === 'string' && p.trim() && pointRelais === null)) return { erreur: 'montant_invalide' };
    grille.push({ wilaya: code, domicile, pointRelais });
  }
  const r = await avecCommercant(s.commercant.id, (trx) => enregistrerFrais(trx, ctxDe(s), grille));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/reglages/livraison');
  return { ok: true };
});
