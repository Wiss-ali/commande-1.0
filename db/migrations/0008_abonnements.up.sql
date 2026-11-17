-- Étape 7 : formules, abonnements, paiements reçus hors application, modules retouchés par commerçant.

-- ───────────── Formules (réglages de l'administrateur) ─────────────
CREATE TABLE formules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE CHECK (length(nom) BETWEEN 1 AND 60),
  -- Prix d'une période, en centimes de dinar ; durée d'une période en jours (30 : un mois, 365 : un an).
  prix bigint NOT NULL CHECK (prix BETWEEN 0 AND 100000000),
  duree_jours integer NOT NULL CHECK (duree_jours BETWEEN 1 AND 1100),
  -- Modules compris (le module Stock l'est toujours : la caisse a besoin des fiches produits).
  modules jsonb NOT NULL DEFAULT '["stock"]',
  active boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Paiements reçus (CCP, BaridiMob, virement, espèces), saisis à la main ─────────────
CREATE TABLE paiements_abonnement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  formule_id uuid NOT NULL REFERENCES formules (id),
  montant bigint NOT NULL CHECK (montant BETWEEN 0 AND 100000000),
  moyen text NOT NULL CHECK (moyen IN ('ccp', 'baridimob', 'virement', 'especes')),
  recu_le date NOT NULL,
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 80),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  saisi_par uuid NOT NULL REFERENCES administrateurs (id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paiements_abonnement_commercant ON paiements_abonnement (commercant_id, recu_le DESC);
CREATE INDEX paiements_abonnement_date ON paiements_abonnement (recu_le);

-- ───────────── Périodes d'abonnement (une par paiement) ─────────────
CREATE TABLE abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  formule_id uuid NOT NULL REFERENCES formules (id),
  paiement_id uuid NOT NULL UNIQUE REFERENCES paiements_abonnement (id),
  debut date NOT NULL,
  fin date NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > debut)
);
CREATE INDEX abonnements_commercant ON abonnements (commercant_id, fin DESC);

-- Retouche des modules, commerçant par commerçant, par l'administrateur.
ALTER TABLE commercants ADD COLUMN modules_ajoutes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE commercants ADD COLUMN modules_retires jsonb NOT NULL DEFAULT '[]';

-- Une ligne de paiement ou de période ne se modifie pas et ne se supprime pas (trace comptable).
CREATE FUNCTION ligne_figee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ligne_figee'; END $$;
CREATE TRIGGER paiements_figes BEFORE UPDATE OR DELETE ON paiements_abonnement FOR EACH ROW EXECUTE FUNCTION ligne_figee();
CREATE TRIGGER abonnements_figes BEFORE UPDATE OR DELETE ON abonnements FOR EACH ROW EXECUTE FUNCTION ligne_figee();

-- ───────────── Droits ─────────────
ALTER TABLE formules ENABLE ROW LEVEL SECURITY;
ALTER TABLE formules FORCE ROW LEVEL SECURITY;
CREATE POLICY lecture ON formules FOR SELECT TO hanout_app, hanout_auth USING (true);
CREATE POLICY plateforme ON formules TO hanout_plateforme USING (true) WITH CHECK (true);
GRANT SELECT ON formules TO hanout_app, hanout_auth;
GRANT SELECT, INSERT, UPDATE ON formules TO hanout_plateforme;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['paiements_abonnement', 'abonnements'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- Le commerçant lit ses propres périodes et paiements, sans pouvoir les écrire.
    EXECUTE format('CREATE POLICY isolation ON %I FOR SELECT TO hanout_app USING (commercant_id = app_commercant())', t);
    EXECUTE format('CREATE POLICY lecture_auth ON %I FOR SELECT TO hanout_auth USING (true)', t);
    EXECUTE format('CREATE POLICY plateforme ON %I TO hanout_plateforme USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT ON %I TO hanout_app, hanout_auth', t);
    EXECUTE format('GRANT SELECT, INSERT ON %I TO hanout_plateforme', t);
  END LOOP;
END $$;
-- Le commerçant ne peut pas changer ses modules autorisés (pas de droit sur ces colonnes) ; l'administrateur oui.
GRANT UPDATE (modules_ajoutes, modules_retires) ON commercants TO hanout_plateforme;
GRANT UPDATE (nom_fr, nom_ar, active) ON wilayas TO hanout_plateforme;

-- Délai après la fin (accès complet), puis durée de la lecture seule avant archivage, et rappels (jours avant la fin).
INSERT INTO reglages_plateforme (cle, valeur) VALUES
  ('delai_grace_jours', '5'),
  ('lecture_seule_jours', '90'),
  ('rappel_jours_1', '7'),
  ('rappel_jours_2', '1');
