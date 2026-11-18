-- Lot d'ajouts 1 : fournisseurs, arrivages de marchandise (entrée en stock au coût moyen pondéré), paiements aux fournisseurs.

CREATE TABLE fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 120),
  -- Téléphone professionnel du grossiste ou du fabricant (pas un acheteur) : gardé lisible pour l'appeler.
  telephone text CHECK (telephone IS NULL OR telephone ~ '^0[0-9]{8,9}$'),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  archive_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id)
);
CREATE INDEX fournisseurs_commercant ON fournisseurs (commercant_id, nom);

-- Un arrivage : ce qui est reçu d'un fournisseur, avec le prix payé par article. Ne se modifie plus.
CREATE TABLE arrivages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  numero integer NOT NULL CHECK (numero > 0),
  fournisseur_id uuid,
  -- Numéro de la facture ou du bon du fournisseur (facultatif).
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 60),
  recu_le date NOT NULL DEFAULT current_date,
  total bigint NOT NULL CHECK (total >= 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  cle uuid,
  UNIQUE (id, commercant_id),
  UNIQUE (commercant_id, numero),
  FOREIGN KEY (fournisseur_id, commercant_id) REFERENCES fournisseurs (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX arrivages_commercant ON arrivages (commercant_id, recu_le DESC);
CREATE INDEX arrivages_fournisseur ON arrivages (fournisseur_id) WHERE fournisseur_id IS NOT NULL;
CREATE UNIQUE INDEX arrivages_cle ON arrivages (commercant_id, cle) WHERE cle IS NOT NULL;

CREATE TABLE lignes_arrivage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  arrivage_id uuid NOT NULL,
  variante_id uuid NOT NULL,
  quantite integer NOT NULL CHECK (quantite > 0),
  -- Prix payé au fournisseur pour une unité.
  cout_unitaire bigint NOT NULL CHECK (cout_unitaire >= 0),
  FOREIGN KEY (arrivage_id, commercant_id) REFERENCES arrivages (id, commercant_id),
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id)
);
CREATE INDEX lignes_arrivage_arrivage ON lignes_arrivage (arrivage_id);

-- Mouvement d'entrée créé par un arrivage : lien gardé dans les deux sens.
ALTER TABLE mouvements_stock ADD COLUMN arrivage_id uuid;
ALTER TABLE mouvements_stock ADD FOREIGN KEY (arrivage_id, commercant_id) REFERENCES arrivages (id, commercant_id);

-- Argent versé à un fournisseur (pour un arrivage ou sur son compte). En espèces depuis la caisse ouverte,
-- il diminue ce qui doit s'y trouver à la clôture. Ne se modifie ni ne s'efface.
CREATE TABLE paiements_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  fournisseur_id uuid NOT NULL,
  arrivage_id uuid,
  montant bigint NOT NULL CHECK (montant > 0),
  mode text NOT NULL CHECK (mode IN ('especes', 'cheque', 'virement', 'ccp', 'autre')),
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 60),
  session_caisse_id uuid,
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  cle uuid,
  FOREIGN KEY (fournisseur_id, commercant_id) REFERENCES fournisseurs (id, commercant_id),
  FOREIGN KEY (arrivage_id, commercant_id) REFERENCES arrivages (id, commercant_id),
  FOREIGN KEY (session_caisse_id, commercant_id) REFERENCES sessions_caisse (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX paiements_fournisseurs_fournisseur ON paiements_fournisseurs (fournisseur_id, cree_le DESC);
CREATE INDEX paiements_fournisseurs_caisse ON paiements_fournisseurs (session_caisse_id) WHERE session_caisse_id IS NOT NULL;
CREATE UNIQUE INDEX paiements_fournisseurs_cle ON paiements_fournisseurs (commercant_id, cle) WHERE cle IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fournisseurs', 'arrivages', 'lignes_arrivage', 'paiements_fournisseurs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT ON arrivages, lignes_arrivage, paiements_fournisseurs TO hanout_app;
GRANT SELECT, INSERT, UPDATE (nom, telephone, note, archive_le) ON fournisseurs TO hanout_app;
