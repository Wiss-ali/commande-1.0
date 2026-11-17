// Lecture et vérification des variables d'environnement. Aucun secret n'est écrit dans le code.
import { z } from 'zod';

const schema = z.object({
  URL_APP: z.url(),
  DATABASE_URL_APP: z.string().min(1),
  DATABASE_URL_AUTH: z.string().min(1),
  DATABASE_URL_PLATEFORME: z.string().min(1),
  DATABASE_SSL: z.enum(['off', 'require']).default('off'),
  CLES_CHIFFREMENT: z.string().min(1),
  CLE_CHIFFREMENT_ACTIVE: z.string().regex(/^\d+$/),
  CLE_HMAC: z.string().min(1),
  // Domaine des boutiques (« mondomaine.dz » : chaque boutique a « nom.mondomaine.dz »). Vide : adresse /b/nom seulement.
  DOMAINE_BOUTIQUES: z.string().regex(/^[a-z0-9.-]+$/).optional(),
  // Clés VAPID des notifications sur le téléphone (npm run push:cles). Absentes : notifications dans l'application seulement.
  VAPID_PUBLIQUE: z.string().optional(),
  VAPID_PRIVEE: z.string().optional(),
  VAPID_CONTACT: z.string().optional(),
});

export type Config = z.infer<typeof schema> & { https: boolean };

let memo: Config | undefined;

export function config(): Config {
  if (!memo) {
    const r = schema.safeParse(process.env);
    if (!r.success) {
      const noms = r.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Configuration invalide ou incomplète : ${noms}`);
    }
    memo = { ...r.data, https: r.data.URL_APP.startsWith('https://') };
  }
  return memo;
}
