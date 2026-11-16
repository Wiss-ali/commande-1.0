// Droits de chaque rôle. Toute action serveur vérifie un droit avec `peut`.
import type { NomModule, Role } from './types-bd.ts';

export type Droit =
  | 'vendre' // caisse, commandes, factures, clients
  | 'preparer' // colis, scan, inventaire, consulter le stock
  | 'produits.creer' // ajouter un produit (sans prix d'achat pour le vendeur)
  | 'stock.corriger' // modifier ou archiver un produit, importer, corriger le stock, valider un inventaire, prix d'achat
  | 'rapports' // marge, rapports, prix d'achat
  | 'reglages' // informations légales, modules, boutique, abonnement
  | 'equipe'; // inviter, changer un rôle, bloquer, supprimer

const DROITS: Record<Role, ReadonlySet<Droit>> = {
  proprietaire: new Set<Droit>(['vendre', 'preparer', 'produits.creer', 'stock.corriger', 'rapports', 'reglages', 'equipe']),
  vendeur: new Set<Droit>(['vendre', 'preparer', 'produits.creer']),
  preparateur: new Set<Droit>(['preparer']),
};

export const peut = (role: Role, droit: Droit): boolean => DROITS[role].has(droit);

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
