-- Lot d'ajouts 1 : dépenses du magasin et versements du transporteur.

-- ───────────── Dépenses ─────────────
-- Loyer, électricité, salaires… Payée avec l'argent de la caisse ouverte (espèces), elle diminue ce qui doit
-- s'y trouver à la clôture. Une dépense saisie par erreur s'annule (trace gardée), tant que sa caisse n'est pas clôturée.
CREATE TABLE depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  categorie text NOT NULL CHECK (categorie IN ('loyer', 'electricite_eau', 'salaires', 'transport', 'fournitures', 'entretien', 'impots', 'publicite', 'autre')),
  libelle text NOT NULL DEFAULT '' CHECK (length(libelle) <= 120),
  montant bigint NOT NULL CHECK (montant > 0),
  depense_le date NOT NULL DEFAULT current_date,
  mode text NOT NULL CHECK (mode IN ('especes', 'cheque', 'virement', 'ccp', 'autre')),
  session_caisse_id uuid,
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  annulee_le timestamptz,
  annulee_par uuid,
  cle uuid,
  CHECK (session_caisse_id IS NULL OR mode = 'especes'),
  FOREIGN KEY (session_caisse_id, commercant_id) REFERENCES sessions_caisse (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  FOREIGN KEY (annulee_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX depenses_commercant ON depenses (commercant_id, depense_le DESC);
CREATE INDEX depenses_caisse ON depenses (session_caisse_id) WHERE session_caisse_id IS NOT NULL;
CREATE UNIQUE INDEX depenses_cle ON depenses (commercant_id, cle) WHERE cle IS NOT NULL;
-- Seule l'annulation change une dépense, une seule fois, et jamais après la clôture de sa caisse.
CREATE FUNCTION depense_figee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.annulee_le IS NOT NULL OR NEW.annulee_le IS NULL THEN RAISE EXCEPTION 'depense_figee'; END IF;
  IF (to_jsonb(NEW) - 'annulee_le' - 'annulee_par') <> (to_jsonb(OLD) - 'annulee_le' - 'annulee_par') THEN RAISE EXCEPTION 'depense_figee'; END IF;
  IF OLD.session_caisse_id IS NOT NULL AND EXISTS (SELECT 1 FROM sessions_caisse s WHERE s.id = OLD.session_caisse_id AND s.fermee_le IS NOT NULL) THEN
    RAISE EXCEPTION 'caisse_cloturee';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER depenses_figees BEFORE UPDATE ON depenses FOR EACH ROW EXECUTE FUNCTION depense_figee();

-- ───────────── Versements du transporteur ─────────────
-- Le transporteur encaisse l'argent des colis livrés, puis le reverse au commerçant (souvent en une fois pour
-- plusieurs colis, frais retenus). Un versement regroupe des commandes livrées.
CREATE TABLE versements_transporteur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  transporteur_id uuid,
  recu_le date NOT NULL DEFAULT current_date,
  -- Total des colis concernés (ce que les clients ont payé) et somme réellement reçue ; l'écart : frais retenus.
  attendu bigint NOT NULL CHECK (attendu >= 0),
  recu bigint NOT NULL CHECK (recu >= 0),
  mode text NOT NULL CHECK (mode IN ('especes', 'cheque', 'virement', 'ccp', 'autre')),
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 60),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  cle uuid,
  UNIQUE (id, commercant_id),
  FOREIGN KEY (transporteur_id, commercant_id) REFERENCES transporteurs (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX versements_commercant ON versements_transporteur (commercant_id, recu_le DESC);
CREATE UNIQUE INDEX versements_cle ON versements_transporteur (commercant_id, cle) WHERE cle IS NOT NULL;
ALTER TABLE commandes ADD COLUMN versement_id uuid;
ALTER TABLE commandes ADD FOREIGN KEY (versement_id, commercant_id) REFERENCES versements_transporteur (id, commercant_id);
CREATE INDEX commandes_a_reverser ON commandes (commercant_id) WHERE statut = 'livree' AND versement_id IS NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['depenses', 'versements_transporteur'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE (annulee_le, annulee_par) ON depenses TO hanout_app;
GRANT SELECT, INSERT ON versements_transporteur TO hanout_app;
