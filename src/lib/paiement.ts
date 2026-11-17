// Paiement par carte (CIB, Edahabia) : NON intégré, volontairement (cahier des charges, partie 5).
// Cette interface reste vide. Le jour où une passerelle certifiée sera choisie, elle s'y branchera :
// l'acheteur sera redirigé vers la page de la passerelle, et l'application ne recevra qu'un résultat signé.
// L'application ne doit JAMAIS recevoir, afficher ni stocker un numéro de carte.
export interface PasserelleCarte {
  readonly nom: string;
  /** Adresse de la page de paiement de la passerelle pour une commande (montant en centimes). */
  creerPaiement(o: { commandeId: string; montant: number; retour: string }): Promise<{ adresse: string }>;
  /** Vérifie la signature d'un résultat envoyé par la passerelle. */
  verifierResultat(corps: string, signature: string): Promise<{ commandeId: string; paye: boolean } | null>;
}

/** Aucune passerelle n'est branchée : le paiement à la livraison est le seul mode actif. */
export const PASSERELLE: PasserelleCarte | null = null;
