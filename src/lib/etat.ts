// Réponse d'une action serveur à un formulaire.
export interface Etat {
  /** Clé de traduction sous « erreurs ». */
  erreur?: string;
  ok?: boolean;
  /** Lien d'invitation ou de réinitialisation à transmettre. */
  lien?: string;
  /** Codes de secours, affichés une seule fois. */
  codes?: string[];
  /** Activation de la double authentification : QR code (image) et clé à saisir à la main. */
  qr?: string;
  cle?: string;
  /** Nombre lié au message de réussite (par exemple le nombre de corrections d'un inventaire). */
  nombre?: number;
}
