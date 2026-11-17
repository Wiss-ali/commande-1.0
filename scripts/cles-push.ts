// Crée la paire de clés VAPID des notifications sur le téléphone. À lancer UNE fois, puis à copier dans .env :
// changer de clés désabonne tous les téléphones déjà inscrits.
import { creerClesVapid } from '../src/lib/push.ts';

const c = creerClesVapid();
console.log(`VAPID_PUBLIQUE=${c.publique}`);
console.log(`VAPID_PRIVEE=${c.privee}`);
console.log('VAPID_CONTACT=mailto:adresse-de-contact@votre-domaine.dz');
