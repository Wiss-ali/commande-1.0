'use server';
// Données personnelles d'un client : suppression à sa demande, par le propriétaire seulement. Journalisée.
import { revalidatePath } from 'next/cache';
import { action, texte } from '@/lib/actions';
import { avecCommercant } from '@/lib/bd';
import { supprimerDonneesClient } from '@/lib/clients';
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
