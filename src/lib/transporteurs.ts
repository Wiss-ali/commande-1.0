// Interface prête pour brancher plus tard l'API d'un transporteur (Yalidine, ZR Express, EcoTrack…).
// Aujourd'hui aucun connecteur n'existe : le transporteur et le numéro de suivi sont saisis à la main.
// Un connecteur ne reçoit que ce qu'il faut pour créer le colis ; ses identifiants d'API viendront des
// variables d'environnement ou d'un coffre chiffré, jamais de la base en clair ni du code.
import type { ModeLivraison, StatutCommande } from './types-bd.ts';

export interface ColisAEnvoyer {
  reference: string;
  destinataire: { nom: string; telephone: string };
  wilaya: number;
  commune: string;
  livraison: ModeLivraison;
  adresse: string | null;
  /** Montant à encaisser à la livraison, en centimes. */
  montant: number;
  articles: { designation: string; quantite: number }[];
}

export interface ConnecteurTransporteur {
  /** Nom technique, gardé dans `transporteurs.connecteur`. */
  readonly nom: string;
  /** Crée le colis chez le transporteur et renvoie son numéro de suivi. */
  creerColis(colis: ColisAEnvoyer): Promise<{ numeroSuivi: string }>;
  /** Où en est le colis, traduit dans les statuts de l'application. */
  suivre(numeroSuivi: string): Promise<{ statut: Extract<StatutCommande, 'expediee' | 'livree' | 'retournee'>; le: Date } | null>;
}

/** Connecteurs disponibles. Vide : chaque connecteur s'ajoutera ici, un fichier par transporteur. */
export const CONNECTEURS: Readonly<Record<string, ConnecteurTransporteur>> = {};
