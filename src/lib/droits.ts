// Droits de chaque rôle. Toute action serveur vérifie un droit avec `peut`.
import type { NomModule, Role } from './types-bd.ts';

export type Droit =
  | 'vendre' // caisse, commandes, factures, clients
  | 'preparer' // colis, scan, inventaire, consulter le stock
  | 'produits.gerer' // ajouter et modifier un produit : le propriétaire, et le vendeur à qui il l'a accordé
  | 'stock.corriger' // archiver un produit, importer, corriger le stock, valider un inventaire, prix d'achat
  | 'rapports' // marge, rapports, prix d'achat
  | 'reglages' // informations légales, modules, boutique, abonnement
  | 'equipe'; // inviter, changer un rôle, bloquer, supprimer

const DROITS: Record<Role, ReadonlySet<Droit>> = {
  proprietaire: new Set<Droit>(['vendre', 'preparer', 'produits.gerer', 'stock.corriger', 'rapports', 'reglages', 'equipe']),
  vendeur: new Set<Droit>(['vendre', 'preparer']),
  preparateur: new Set<Droit>(['preparer']),
};

export const peut = (role: Role, droit: Droit): boolean => DROITS[role].has(droit);

/** Comme `peut`, en tenant compte des droits accordés à la personne par le propriétaire. */
export const autorise = (u: { role: Role; gereProduits: boolean }, droit: Droit): boolean =>
  peut(u.role, droit) || (droit === 'produits.gerer' && u.role === 'vendeur' && u.gereProduits);

/** Droit nécessaire pour ouvrir chaque module. */
export const DROIT_MODULE: Record<NomModule, Droit> = {
  stock: 'preparer',
  caisse: 'vendre',
  factures: 'vendre',
  commandes: 'preparer',
  clients: 'vendre',
  rapports: 'rapports',
  boutique: 'reglages',
};

export const MODULES: readonly NomModule[] = ['stock', 'caisse', 'factures', 'commandes', 'boutique', 'clients', 'rapports'];
