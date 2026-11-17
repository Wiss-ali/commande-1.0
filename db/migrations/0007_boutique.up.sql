-- Étape 6 : boutique en ligne, tickets des acheteurs, demandes à l'administrateur, notifications.

-- ───────────── Boutique (une par commerçant, coupée à la création) ─────────────
CREATE TABLE boutiques (
  commercant_id uuid PRIMARY KEY REFERENCES commercants (id),
  en_ligne boolean NOT NULL DEFAULT false,
  modele text NOT NULL DEFAULT 'vitrine' CHECK (modele IN ('vitrine', 'catalogue', 'grandes_photos', 'produit_unique')),
  -- Produit mis en avant par le modèle « Produit unique ».
  produit_unique_id uuid,
  -- Couleur principale : une clé de la palette du produit (contraste vérifié), jamais une couleur libre.
  couleur text NOT NULL DEFAULT 'emeraude' CHECK (couleur ~ '^[a-z]{3,20}$'),
  logo_id uuid,
  banniere_id uuid,
  accueil_fr text NOT NULL DEFAULT '' CHECK (length(accueil_fr) <= 500),
  accueil_ar text NOT NULL DEFAULT '' CHECK (length(accueil_ar) <= 500),
  livraison_fr text NOT NULL DEFAULT '' CHECK (length(livraison_fr) <= 1000),
  livraison_ar text NOT NULL DEFAULT '' CHECK (length(livraison_ar) <= 1000),
  retour_fr text NOT NULL DEFAULT '' CHECK (length(retour_fr) <= 1000),
  retour_ar text NOT NULL DEFAULT '' CHECK (length(retour_ar) <= 1000),
  -- Ordre des sections de la page d'accueil (clés connues de l'application).
  sections jsonb NOT NULL DEFAULT '["accueil", "produits", "conditions", "contact"]',
  reseaux jsonb NOT NULL DEFAULT '{}',
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^0[5-7][0-9]{8}$'),
  -- Produit épuisé : affiché « Rupture de stock » ou masqué.
  ruptures text NOT NULL DEFAULT 'visible' CHECK (ruptures IN ('visible', 'masque')),
  -- Pastille « Plus que N » (0 : jamais).
  plus_que integer NOT NULL DEFAULT 3 CHECK (plus_que BETWEEN 0 AND 99),
  -- Durée de réservation du stock d'un ticket, en heures.
  reservation_heures integer NOT NULL DEFAULT 24 CHECK (reservation_heures BETWEEN 1 AND 168),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (produit_unique_id, commercant_id) REFERENCES produits (id, commercant_id),
  FOREIGN KEY (logo_id) REFERENCES photos_produit (id) ON DELETE SET NULL,
  FOREIGN KEY (banniere_id) REFERENCES photos_produit (id) ON DELETE SET NULL
);
CREATE TRIGGER boutiques_modifie BEFORE UPDATE ON boutiques FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- Le logo et la bannière sont des images rangées comme les photos des produits, sans produit.
ALTER TABLE photos_produit ALTER COLUMN produit_id DROP NOT NULL;

-- Pastille « Nouveau » choisie par le commerçant.
ALTER TABLE produits ADD COLUMN nouveau boolean NOT NULL DEFAULT false;

-- Adresse de la boutique : choisie par le commerçant, vérifiée par l'application et par la base.
ALTER TABLE commercants ADD CONSTRAINT sous_domaine_format CHECK (sous_domaine IS NULL OR sous_domaine ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');
GRANT UPDATE (sous_domaine) ON commercants TO hanout_app;

-- ───────────── Tickets des acheteurs ─────────────
-- Un ticket est une commande de la boutique : lien privé (empreinte seulement), fin de la réservation du stock.
ALTER TABLE commandes ADD COLUMN ticket_hash text UNIQUE;
ALTER TABLE commandes ADD COLUMN reservation_jusqua timestamptz;
CREATE INDEX commandes_reservation ON commandes (reservation_jusqua) WHERE statut = 'nouvelle';
ALTER TABLE historique_commande DROP CONSTRAINT historique_commande_evenement_check;
ALTER TABLE historique_commande ADD CONSTRAINT historique_commande_evenement_check CHECK (evenement IN ('creee', 'appel_sans_reponse', 'statut', 'modifiee', 'expiree'));

-- ───────────── Demandes à l'administrateur ─────────────
CREATE TABLE demandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  type text NOT NULL CHECK (type IN ('paiement_carte', 'site_personnalise')),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 120),
  telephone text NOT NULL CHECK (telephone ~ '^0[5-7][0-9]{8}$'),
  message text NOT NULL DEFAULT '' CHECK (length(message) <= 500),
  etat text NOT NULL DEFAULT 'nouvelle' CHECK (etat IN ('nouvelle', 'traitee', 'refusee')),
  note_admin text NOT NULL DEFAULT '' CHECK (length(note_admin) <= 500),
  cree_le timestamptz NOT NULL DEFAULT now(),
  traitee_le timestamptz
);
-- Une seule demande ouverte par type et par commerçant.
CREATE UNIQUE INDEX demandes_ouvertes ON demandes (commercant_id, type) WHERE etat = 'nouvelle';

-- ───────────── Notifications ─────────────
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  type text NOT NULL CHECK (type IN ('commande_boutique')),
  commande_id uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commande_id, commercant_id) REFERENCES commandes (id, commercant_id)
);
CREATE INDEX notifications_commercant ON notifications (commercant_id, cree_le DESC);

-- Dernière consultation des notifications, par personne.
CREATE TABLE notifications_vues (
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  utilisateur_id uuid PRIMARY KEY,
  vu_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (utilisateur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);

-- Abonnements aux notifications du téléphone (Web Push). Adresse et clés du navigateur chiffrées.
CREATE TABLE abonnements_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  utilisateur_id uuid NOT NULL,
  point_hmac text NOT NULL UNIQUE,
  abonnement_chiffre text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (utilisateur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);

-- ───────────── Isolation et droits ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['boutiques', 'demandes', 'notifications', 'notifications_vues', 'abonnements_push'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE ON boutiques TO hanout_app;
-- Le commerçant crée et lit ses demandes ; seul l'administrateur les traite.
GRANT SELECT, INSERT ON demandes TO hanout_app;
CREATE POLICY plateforme ON demandes TO hanout_plateforme USING (true) WITH CHECK (true);
GRANT SELECT, UPDATE (etat, note_admin, traitee_le) ON demandes TO hanout_plateforme;
GRANT SELECT, INSERT ON notifications TO hanout_app;
GRANT SELECT, INSERT, UPDATE ON notifications_vues TO hanout_app;
GRANT SELECT, INSERT, DELETE ON abonnements_push TO hanout_app;
-- L'administrateur voit l'adresse et l'état de chaque boutique (liste des commerçants).
CREATE POLICY plateforme ON boutiques FOR SELECT TO hanout_plateforme USING (true);
GRANT SELECT ON boutiques TO hanout_plateforme;
