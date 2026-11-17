// Réglages de la plateforme (durées, longueurs minimales…). Gardés une minute en mémoire.
import { bd } from './bd.ts';

const DEFAUTS = {
  mdp_min_proprietaire: 8,
  mdp_min_employe: 8,
  mdp_min_administrateur: 15,
  session_jours_utilisateur: 30,
  session_heures_administrateur: 12,
  invitation_jours: 7,
  connexion_echecs_max: 5,
  connexion_blocage_minutes: 15,
} as const;
export type CleReglage = keyof typeof DEFAUTS;

let memo: { lu: number; valeurs: Map<string, unknown> } | undefined;

export async function reglage(cle: CleReglage): Promise<number> {
  if (!memo || Date.now() - memo.lu > 60_000) {
    const lignes = await bd('auth').selectFrom('reglages_plateforme').select(['cle', 'valeur']).execute();
    memo = { lu: Date.now(), valeurs: new Map(lignes.map((l) => [l.cle, l.valeur])) };
  }
  const v = memo.valeurs.get(cle);
  return typeof v === 'number' && Number.isFinite(v) ? v : DEFAUTS[cle];
}

export const oublierReglages = () => (memo = undefined);

/** Réglage complexe (liste, tableau) : renvoyé tel quel, à valider par l'appelant. */
export async function reglageBrut(cle: 'taux_tva' | 'timbre'): Promise<unknown> {
  await reglage('invitation_jours'); // recharge la mémoire au besoin
  return memo?.valeurs.get(cle);
}
