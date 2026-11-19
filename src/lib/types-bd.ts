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
  reglages_documents: ColumnType<unknown, string | undefined, string>;
  modules_ajoutes: ColumnType<NomModule[], string | undefined, string>;
  modules_retires: ColumnType<NomModule[], string | undefined, string>;
  demo: Generated<boolean>;
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
  gere_produits: Generated<boolean>;
  peut_remiser: Generated<boolean>;
  barre_bas: string[] | null;
  totp_secret_chiffre: string | null;
  totp_actif: Generated<boolean>;
  codes_secours: Generated<string[]>;
  totp_dernier_pas: number | null;
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
  totp_dernier_pas: number | null;
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
  gere_produits: Generated<boolean>;
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
  modifie_le: ColumnType<Date, Date | undefined, Date>;
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
  taux_tva: number | null;
  visible_boutique: Generated<boolean>;
  nouveau: Generated<boolean>;
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
  arrivage_id: string | null;
  cle: string | null;
  cree_le: Generated<Date>;
}

export interface PhotosProduit {
  id: Generated<string>;
  commercant_id: string;
  produit_id: string | null;
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

export interface Clients {
  id: Generated<string>;
  commercant_id: string;
  nom: string;
  telephone_chiffre: string | null;
  telephone_hmac: string | null;
  details_chiffre: string | null;
  supprime_le: HorodatageNul;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
}

export interface SessionsCaisse {
  id: Generated<string>;
  commercant_id: string;
  ouverte_par: string;
  ouverte_le: Generated<Date>;
  fond_ouverture: ColumnType<string, number | undefined, number>;
  fermee_par: string | null;
  fermee_le: HorodatageNul;
  especes_attendues: ColumnType<string | null, number | null | undefined, number | null>;
  especes_comptees: ColumnType<string | null, number | null | undefined, number | null>;
  note: Generated<string>;
}

export interface CompteursDocuments {
  commercant_id: string;
  type: string;
  annee: number;
  dernier: Generated<number>;
}

export type TypeDocument = 'devis' | 'proforma' | 'bon_commande' | 'bon_livraison' | 'facture' | 'avoir' | 'recu' | 'ticket';
export type EtatDocument = 'emis' | 'en_attente' | 'transforme' | 'refuse' | 'expire';
/** Moyens d'encaissement choisis par le vendeur. */
export type ModeEncaissement = 'especes' | 'cheque' | 'virement' | 'ccp' | 'autre';
export const MODES_ENCAISSEMENT: readonly ModeEncaissement[] = ['especes', 'cheque', 'virement', 'ccp', 'autre'];
/** Résumé porté par le document : le moyen, « à la livraison », ou « mixte » s'il y en a eu plusieurs. */
export type ModePaiement = ModeEncaissement | 'a_la_livraison' | 'mixte';

type Montant = ColumnType<string, number, number>;

export interface Documents {
  id: string;
  commercant_id: string;
  type: TypeDocument;
  annee: number;
  numero: number;
  etat: EtatDocument;
  origine: 'caisse' | 'manuel' | 'boutique';
  mode_vente: 'directe' | 'envoi' | null;
  client_id: string | null;
  vendeur_chiffre: string;
  acheteur_chiffre: string | null;
  total_ht: Montant;
  total_tva: Montant;
  timbre: Montant;
  total: Montant;
  mode_paiement: ModePaiement | null;
  paye_le: HorodatageNul;
  valide_jusqua: ColumnType<Date | null, string | null | undefined, string | null>;
  stock_sorti: Generated<boolean>;
  note: Generated<string>;
  session_caisse_id: string | null;
  emis_par: string;
  emis_le: Generated<Date>;
  cle: string | null;
  transaction_creation: Generated<string>;
}

export interface LignesDocument {
  id: Generated<string>;
  commercant_id: string;
  document_id: string;
  variante_id: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: Montant;
  taux_tva: number;
  total_ht: Montant;
  total_ttc: Montant;
  cout_unitaire: Montant;
  remise: ColumnType<string, number | undefined, number>;
  ligne_origine_id: string | null;
  ordre: number;
}

export interface Paiements {
  id: Generated<string>;
  commercant_id: string;
  document_id: string;
  montant: Montant;
  mode: ModeEncaissement | 'a_la_livraison';
  reference: Generated<string>;
  piece_id: string | null;
  session_caisse_id: string | null;
  cree_par: string;
  cree_le: Generated<Date>;
}

/** Vue : ce qui reste vendu après les avoirs (net) et ce qui a été payé, pour chaque facture ou ticket. */
export interface SoldesDocuments {
  document_id: string;
  commercant_id: string;
  client_id: string | null;
  type: TypeDocument;
  mode_vente: 'directe' | 'envoi' | null;
  emis_le: Date;
  total: string;
  net: string;
  paye: string;
}

export interface LiensDocuments {
  commercant_id: string;
  source_id: string;
  cible_id: string;
  nature: 'transforme_en' | 'corrige_par' | 'regle_par';
}

export interface EcartsStock {
  id: Generated<string>;
  commercant_id: string;
  variante_id: string;
  document_id: string;
  quantite: number;
  cree_le: Generated<Date>;
  traite_le: HorodatageNul;
  traite_par: string | null;
}

export interface Fournisseurs {
  id: Generated<string>;
  commercant_id: string;
  nom: string;
  telephone: string | null;
  note: Generated<string>;
  archive_le: HorodatageNul;
  cree_le: Generated<Date>;
}

export interface Arrivages {
  id: Generated<string>;
  commercant_id: string;
  numero: number;
  fournisseur_id: string | null;
  reference: Generated<string>;
  recu_le: ColumnType<Date, string | undefined, string>;
  total: Montant;
  note: Generated<string>;
  cree_par: string;
  cree_le: Generated<Date>;
  cle: string | null;
}

export interface LignesArrivage {
  id: Generated<string>;
  commercant_id: string;
  arrivage_id: string;
  variante_id: string;
  quantite: number;
  cout_unitaire: Montant;
}

export interface PaiementsFournisseurs {
  id: Generated<string>;
  commercant_id: string;
  fournisseur_id: string;
  arrivage_id: string | null;
  montant: Montant;
  mode: ModeEncaissement;
  reference: Generated<string>;
  session_caisse_id: string | null;
  cree_par: string;
  cree_le: Generated<Date>;
  cle: string | null;
}

export type CategorieDepense = 'loyer' | 'electricite_eau' | 'salaires' | 'transport' | 'fournitures' | 'entretien' | 'impots' | 'publicite' | 'autre';
export const CATEGORIES_DEPENSE: readonly CategorieDepense[] = ['loyer', 'electricite_eau', 'salaires', 'transport', 'fournitures', 'entretien', 'impots', 'publicite', 'autre'];

export interface Depenses {
  id: Generated<string>;
  commercant_id: string;
  categorie: CategorieDepense;
  libelle: Generated<string>;
  montant: Montant;
  depense_le: ColumnType<Date, string | undefined, string>;
  mode: ModeEncaissement;
  session_caisse_id: string | null;
  cree_par: string;
  cree_le: Generated<Date>;
  annulee_le: HorodatageNul;
  annulee_par: string | null;
  cle: string | null;
}

export interface VersementsTransporteur {
  id: Generated<string>;
  commercant_id: string;
  transporteur_id: string | null;
  recu_le: ColumnType<Date, string | undefined, string>;
  attendu: Montant;
  recu: Montant;
  mode: ModeEncaissement;
  reference: Generated<string>;
  note: Generated<string>;
  cree_par: string;
  cree_le: Generated<Date>;
  cle: string | null;
}

export interface Wilayas {
  code: number;
  nom_fr: string;
  nom_ar: string;
  active: Generated<boolean>;
}

export interface Communes {
  id: Generated<number>;
  wilaya_code: number;
  nom_fr: string;
  nom_ar: Generated<string>;
  active: Generated<boolean>;
}

export interface Transporteurs {
  id: Generated<string>;
  commercant_id: string;
  nom: string;
  actif: Generated<boolean>;
  connecteur: string | null;
  cree_le: Generated<Date>;
}

type MontantNul = ColumnType<string | null, number | null | undefined, number | null>;

export interface FraisLivraison {
  commercant_id: string;
  wilaya_code: number;
  domicile: MontantNul;
  point_relais: MontantNul;
}

export type StatutCommande = 'nouvelle' | 'a_confirmer' | 'confirmee' | 'preparee' | 'expediee' | 'livree' | 'retournee' | 'annulee';
export type ModeLivraison = 'domicile' | 'point_relais';

export interface Commandes {
  id: Generated<string>;
  commercant_id: string;
  annee: number;
  numero: number;
  statut: StatutCommande;
  origine: 'manuel' | 'boutique';
  devis_id: string;
  facture_id: string | null;
  avoir_id: string | null;
  client_id: string;
  tentatives_appel: Generated<number>;
  dernier_appel_le: HorodatageNul;
  livraison: ModeLivraison;
  wilaya_code: number;
  commune: string;
  adresse_chiffre: string | null;
  frais_livraison: ColumnType<string, number | undefined, number>;
  transporteur_id: string | null;
  numero_suivi: string | null;
  expediee_le: HorodatageNul;
  livree_le: HorodatageNul;
  retournee_le: HorodatageNul;
  note: Generated<string>;
  cle: string | null;
  cree_par: string;
  cree_le: Generated<Date>;
  modifie_le: Generated<Date>;
  ticket_hash: string | null;
  reservation_jusqua: HorodatageNul;
  versement_id: string | null;
}

export type EvenementCommande = 'creee' | 'appel_sans_reponse' | 'statut' | 'modifiee' | 'expiree';

export interface HistoriqueCommande {
  id: Generated<string>;
  commercant_id: string;
  commande_id: string;
  evenement: EvenementCommande;
  ancien_statut: StatutCommande | null;
  nouveau_statut: StatutCommande | null;
  auteur: string;
  le: Generated<Date>;
}

export type ModeleBoutique = 'vitrine' | 'catalogue' | 'grandes_photos' | 'produit_unique';

export interface Boutiques {
  commercant_id: string;
  en_ligne: Generated<boolean>;
  modele: Generated<ModeleBoutique>;
  produit_unique_id: string | null;
  couleur: Generated<string>;
  logo_id: string | null;
  banniere_id: string | null;
  accueil_fr: Generated<string>;
  accueil_ar: Generated<string>;
  livraison_fr: Generated<string>;
  livraison_ar: Generated<string>;
  retour_fr: Generated<string>;
  retour_ar: Generated<string>;
  sections: ColumnType<string[], string | undefined, string>;
  reseaux: ColumnType<Record<string, string>, string | undefined, string>;
  whatsapp: string | null;
  ruptures: Generated<'visible' | 'masque'>;
  plus_que: Generated<number>;
  reservation_heures: Generated<number>;
  max_par_article: Generated<number>;
  max_tickets_attente: Generated<number>;
  modifie_le: Generated<Date>;
  pixel_facebook: string | null;
  pixel_tiktok: string | null;
}

export type TypeDemande = 'paiement_carte' | 'site_personnalise';

export interface Demandes {
  id: Generated<string>;
  commercant_id: string;
  type: TypeDemande;
  nom: string;
  telephone: string;
  message: Generated<string>;
  etat: Generated<'nouvelle' | 'traitee' | 'refusee'>;
  note_admin: Generated<string>;
  cree_le: Generated<Date>;
  traitee_le: HorodatageNul;
}

export interface Notifications {
  id: Generated<string>;
  commercant_id: string;
  type: 'commande_boutique';
  commande_id: string | null;
  cree_le: Generated<Date>;
}

export interface NotificationsVues {
  commercant_id: string;
  utilisateur_id: string;
  vu_le: Horodatage;
}

export interface NotificationsLues {
  commercant_id: string;
  utilisateur_id: string;
  notification_id: string;
  lu_le: Generated<Horodatage>;
}

export interface AbonnementsPush {
  id: Generated<string>;
  commercant_id: string;
  utilisateur_id: string;
  point_hmac: string;
  abonnement_chiffre: string;
  cree_le: Generated<Date>;
}

export interface Formules {
  id: Generated<string>;
  nom: string;
  prix: ColumnType<string, number, number>;
  duree_jours: number;
  modules: ColumnType<NomModule[], string | undefined, string>;
  active: Generated<boolean>;
  cree_le: Generated<Date>;
}

export type MoyenPaiement = 'ccp' | 'baridimob' | 'virement' | 'especes';
type Jour = ColumnType<Date, string, string>;

export interface PaiementsAbonnement {
  id: Generated<string>;
  commercant_id: string;
  formule_id: string;
  montant: ColumnType<string, number, number>;
  moyen: MoyenPaiement;
  recu_le: Jour;
  reference: Generated<string>;
  note: Generated<string>;
  saisi_par: string;
  cree_le: Generated<Date>;
}

export interface Abonnements {
  id: Generated<string>;
  commercant_id: string;
  formule_id: string;
  paiement_id: string;
  debut: Jour;
  fin: Jour;
  cree_le: Generated<Date>;
}

export interface BD {
  formules: Formules;
  paiements_abonnement: PaiementsAbonnement;
  abonnements: Abonnements;
  boutiques: Boutiques;
  demandes: Demandes;
  notifications: Notifications;
  notifications_vues: NotificationsVues;
  notifications_lues: NotificationsLues;
  abonnements_push: AbonnementsPush;
  wilayas: Wilayas;
  communes: Communes;
  transporteurs: Transporteurs;
  frais_livraison: FraisLivraison;
  commandes: Commandes;
  historique_commande: HistoriqueCommande;
  clients: Clients;
  sessions_caisse: SessionsCaisse;
  compteurs_documents: CompteursDocuments;
  documents: Documents;
  lignes_document: LignesDocument;
  liens_documents: LiensDocuments;
  ecarts_stock: EcartsStock;
  paiements: Paiements;
  fournisseurs: Fournisseurs;
  arrivages: Arrivages;
  lignes_arrivage: LignesArrivage;
  paiements_fournisseurs: PaiementsFournisseurs;
  depenses: Depenses;
  versements_transporteur: VersementsTransporteur;
  soldes_documents: SoldesDocuments;
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
