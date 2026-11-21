'use server';
// Clients : ajout et correction de la fiche (vendeurs compris), suppression des données à sa demande
// (propriétaire seulement, journalisée).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { action, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import { enregistrerFiche, supprimerDonneesClient } from '@/lib/clients';
import { journaliser } from '@/lib/journal';
import { exigerEcriture, infoRequete } from '@/lib/web';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const effacerClient = action(async (f) => {
  const s = await exigerEcriture('reglages', 'clients');
  const id = texte(f, 'id', 40);
  if (!UUID.test(id) || f.get('confirmer') !== 'on') return { erreur: 'champ_requis' };
  const { ip } = await infoRequete();
  const fait = await avecCommercant(s.commercant.id, async (trx) => {
    const ok = await supprimerDonneesClient(trx, id);
    if (ok) await journaliser(trx, { commercantId: s.commercant.id, acteurType: 'utilisateur', acteurId: s.utilisateur.id, action: 'client.donnees_supprimees', objetType: 'client', objetId: id, ip });
    return ok;
  });
  if (!fait) return { erreur: 'introuvable' };
  revalidatePath('/clients', 'layout');
  return { ok: true };
});

/** Ajoute un client à la main (sans vente ni commande), ou corrige sa fiche. */
export const enregistrerClient = action(async (f) => {
  const s = await exigerEcriture('vendre', 'clients');
  const id = texte(f, 'id', 40);
  if (id && !UUID.test(id)) return { erreur: 'introuvable' };
  const r = await avecCommercant(s.commercant.id, (trx) => enregistrerFiche(trx, s.commercant.id, id || null, {
    nom: texte(f, 'nom', 120),
    telephone: texte(f, 'telephone', 30),
    details: { adresse: texte(f, 'adresse', 300), nif: texte(f, 'nif', 40), rc: texte(f, 'rc', 40), nis: texte(f, 'nis', 40), ai: texte(f, 'ai', 40) },
    note: texte(f, 'note', 500),
  }));
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/clients', 'layout');
  redirect(`/clients/${r.id}`);
});
