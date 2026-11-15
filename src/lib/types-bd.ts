// Types des tables, tenus à la main et alignés sur db/migrations.
import type { ColumnType, Generated } from 'kysely';

type Horodatage = ColumnType<Date, Date | string | undefined, Date | string>;
type HorodatageNul = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;

export type Langue = 'fr' | 'ar';
export type Role = 'proprietaire' | 'vendeur' | 'preparateur';
export type EtatCommercant = 'actif' | 'lecture_seule' | 'suspendu' | 'archive';
export type NomModule = 'stock' | 'caisse' | 'factures' | 'commandes' | 'clients' | 'rapports' | 'boutique';
export type Modules = Record<NomModule, boolean>;

export interface Commercants {
  id: Generated<string>;
  nom: string;
  sous_domaine: string | null;
  langue: Generated<Langue>;
  etat: Generated<EtatCommercant>;
  paiement_carte_actif: Generated<boolean>;
  modules: ColumnType<Modules, string | undefined, string>;
  max_employes: number | null;
  forme_juridique: string | null;
  telephone: string | null;
  adresse_chiffre: string | null;
  rc_chiffre: string | null;
  nif_chiffre: string | null;
  nis_chiffre: string | null;
  ai_chiffre: string | null;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
}

export interface Utilisateurs {
  id: Generated<string>;
  commercant_id: string;
  nom: string;
  telephone: string | null;
  mot_de_passe: string;
  role: Role;
  langue: Generated<Langue>;
  totp_secret_chiffre: string | null;
  totp_actif: Generated<boolean>;
  codes_secours: Generated<string[]>;
  echecs: Generated<number>;
  bloque_jusqua: HorodatageNul;
  desactive: Generated<boolean>;
  supprime_le: HorodatageNul;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
}

export interface Administrateurs {
  id: Generated<string>;
  identifiant: string;
  mot_de_passe: string;
  totp_secret_chiffre: string | null;
  totp_actif: Generated<boolean>;
  codes_secours: Generated<string[]>;
  echecs: Generated<number>;
  bloque_jusqua: HorodatageNul;
  cree_le: Generated<Date>;
}

export interface Sessions {
  id: Generated<string>;
  jeton_hash: string;
  utilisateur_id: string | null;
  commercant_id: string | null;
  administrateur_id: string | null;
  mfa_ok: Generated<boolean>;
  appareil: Generated<string>;
  cree_le: Generated<Date>;
  vue_le: Horodatage;
  expire_le: ColumnType<Date, Date | string, Date | string>;
}

export type TypeInvitation = 'commercant' | 'employe' | 'reinitialisation';

export interface Invitations {
  id: Generated<string>;
  jeton_hash: string;
  type: TypeInvitation;
  commercant_id: string;
  utilisateur_id: string | null;
  nom: string | null;
  telephone: string | null;
  role: Role | null;
  expire_le: ColumnType<Date, Date | string, Date | string>;
  utilisee_le: HorodatageNul;
  annulee_le: HorodatageNul;
  cree_par_utilisateur: string | null;
  cree_par_admin: string | null;
  cree_le: Generated<Date>;
}

export interface JournalActions {
  id: Generated<string>;
  commercant_id: string | null;
  acteur_type: 'utilisateur' | 'administrateur' | 'systeme' | 'anonyme';
  acteur_id: string | null;
  action: string;
  objet_type: string | null;
  objet_id: string | null;
  details: ColumnType<Record<string, unknown>, string | undefined, never>;
  ip_tronquee: string | null;
  cree_le: Generated<Date>;
}

export interface LimitesDebit {
  cle: string;
  debut: Generated<Date>;
  compteur: Generated<number>;
}

export interface ReglagesPlateforme {
  cle: string;
  valeur: ColumnType<unknown, string, string>;
  modifie_le: Generated<Date>;
}

export interface Categories {
  id: Generated<string>;
  commercant_id: string;
  nom_fr: Generated<string>;
  nom_ar: Generated<string>;
  cree_le: Generated<Date>;
}

export interface Produits {
  id: Generated<string>;
  commercant_id: string;
  nom_fr: Generated<string>;
  nom_ar: Generated<string>;
  categorie_id: string | null;
  visible_boutique: Generated<boolean>;
  archive_le: HorodatageNul;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
}

export interface Variantes {
  id: Generated<string>;
  commercant_id: string;
  produit_id: string;
  libelle: Generated<string>;
  code_barres: string | null;
  /** Montants en centimes de dinar (bigint en base, renvoyé en texte par le pilote). */
  prix_achat: ColumnType<string, number | undefined, number>;
  prix_vente: ColumnType<string, number | undefined, number>;
  prix_barre: ColumnType<string | null, number | null | undefined, number | null>;
  seuil_alerte: Generated<number>;
  ordre: Generated<number>;
  archive_le: HorodatageNul;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
}

export interface Stocks {
  variante_id: string;
  commercant_id: string;
  quantite: Generated<number>;
  reservee: Generated<number>;
}

export type TypeMouvement = 'entree' | 'vente' | 'retour' | 'correction' | 'reservation' | 'liberation';
export type MotifMouvement = 'stock_initial' | 'achat' | 'import' | 'inventaire' | 'casse' | 'perte' | 'perime' | 'erreur' | 'autre';

export interface MouvementsStock {
  id: Generated<string>;
  commercant_id: string;
  variante_id: string;
  type: TypeMouvement;
  quantite: number;
  stock_apres: Generated<number>;
  motif: MotifMouvement | null;
  note: Generated<string>;
  cout_unitaire: ColumnType<string | null, number | null | undefined, never>;
  auteur_id: string;
  inventaire_id: string | null;
  document_id: string | null;
  cle: string | null;
  cree_le: Generated<Date>;
}

export interface PhotosProduit {
  id: Generated<string>;
  commercant_id: string;
  produit_id: string;
  ordre: Generated<number>;
  cree_le: Generated<Date>;
}

export type EtatInventaire = 'en_cours' | 'valide' | 'annule';

export interface Inventaires {
  id: Generated<string>;
  commercant_id: string;
  etat: Generated<EtatInventaire>;
  cree_par: string;
  termine_par: string | null;
  cree_le: Generated<Date>;
  termine_le: HorodatageNul;
}

export interface LignesInventaire {
  id: Generated<string>;
  commercant_id: string;
  inventaire_id: string;
  variante_id: string;
  quantite_comptee: number;
  quantite_theorique: number | null;
  compte_par: string;
  modifie_le: Generated<Date>;
}

export interface BD {
  categories: Categories;
  produits: Produits;
  variantes: Variantes;
  stocks: Stocks;
  mouvements_stock: MouvementsStock;
  photos_produit: PhotosProduit;
  inventaires: Inventaires;
  lignes_inventaire: LignesInventaire;
  commercants: Commercants;
  utilisateurs: Utilisateurs;
  administrateurs: Administrateurs;
  sessions: Sessions;
  invitations: Invitations;
  journal_actions: JournalActions;
  limites_debit: LimitesDebit;
  reglages_plateforme: ReglagesPlateforme;
}
