// Tâches périodiques (à lancer toutes les 5 minutes, par exemple avec cron ou un minuteur systemd) :
//  - tickets de la boutique non confirmés à temps : devis expiré, stock libéré, commande annulée ;
//  - nettoyage des compteurs de limite de débit.
// Les mêmes expirations ont aussi lieu à chaque lecture du catalogue : cette tâche les rend ponctuelles.
import { avecCommercant, bd, fermerBD } from '../src/lib/bd.ts';
import { contexteBoutique } from '../src/lib/boutique.ts';
import { expirerTickets } from '../src/lib/commandes.ts';
import { purgerLimites } from '../src/lib/limites.ts';

const commercants = await bd('plateforme').selectFrom('commercants').select('id').execute();
let expires = 0;
for (const { id } of commercants) {
  try {
    expires += await avecCommercant(id, async (trx) => expirerTickets(trx, await contexteBoutique(trx, id)));
  } catch {
    // Commerçant sans propriétaire (invitation pas encore acceptée) : rien à expirer.
  }
}
await purgerLimites();
console.log(`Tickets expirés : ${expires}`);
await fermerBD();
