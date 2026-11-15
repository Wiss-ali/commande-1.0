-- Socle : commerçants, comptes, sessions, invitations, journal.
-- Rôles attendus (créés par scripts/init-roles.ts) : hanout_app, hanout_auth, hanout_plateforme.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO hanout_app, hanout_auth, hanout_plateforme;

-- Commerçant courant, fixé pour la transaction par l'application. NULL si absent : aucune ligne visible.
CREATE FUNCTION app_commercant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.commercant_id', true), '')::uuid $$;

CREATE FUNCTION toucher_modifie_le() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN NEW.modifie_le = now(); RETURN NEW; END $$;

-- ───────────── Commerçants ─────────────
CREATE TABLE commercants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 120),
  sous_domaine text UNIQUE,
  langue text NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'ar')),
  etat text NOT NULL DEFAULT 'actif' CHECK (etat IN ('actif', 'lecture_seule', 'suspendu', 'archive')),
  paiement_carte_actif boolean NOT NULL DEFAULT false,
  modules jsonb NOT NULL DEFAULT '{"stock":true,"caisse":true,"factures":true,"commandes":true,"clients":true,"rapports":true,"boutique":false}',
  max_employes integer CHECK (max_employes IS NULL OR max_employes >= 0),
  forme_juridique text,
  telephone text,
  adresse_chiffre text,
  rc_chiffre text,
  nif_chiffre text,
  nis_chiffre text,
  ai_chiffre text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER commercants_modifie BEFORE UPDATE ON commercants FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();
ALTER TABLE commercants ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercants FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON commercants TO hanout_app USING (id = app_commercant()) WITH CHECK (id = app_commercant());
CREATE POLICY lecture_auth ON commercants FOR SELECT TO hanout_auth USING (true);
CREATE POLICY plateforme ON commercants TO hanout_plateforme USING (true) WITH CHECK (true);
-- Le commerçant ne peut changer ni son état, ni son abonnement, ni le paiement par carte.
GRANT SELECT ON commercants TO hanout_app, hanout_auth;
GRANT UPDATE (nom, langue, modules, forme_juridique, telephone, adresse_chiffre, rc_chiffre, nif_chiffre, nis_chiffre, ai_chiffre)
  ON commercants TO hanout_app;
GRANT SELECT, INSERT, UPDATE ON commercants TO hanout_plateforme;

-- ───────────── Utilisateurs ─────────────
CREATE TABLE utilisateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 80),
  telephone text UNIQUE CHECK (telephone ~ '^0[0-9]{9}$'),
  mot_de_passe text NOT NULL,
  role text NOT NULL CHECK (role IN ('proprietaire', 'vendeur', 'preparateur')),
  langue text NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'ar')),
  totp_secret_chiffre text,
  totp_actif boolean NOT NULL DEFAULT false,
  codes_secours text[] NOT NULL DEFAULT '{}',
  echecs integer NOT NULL DEFAULT 0,
  bloque_jusqua timestamptz,
  desactive boolean NOT NULL DEFAULT false,
  supprime_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id)
);
CREATE INDEX utilisateurs_commercant ON utilisateurs (commercant_id);
CREATE TRIGGER utilisateurs_modifie BEFORE UPDATE ON utilisateurs FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON utilisateurs TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
CREATE POLICY auth ON utilisateurs TO hanout_auth USING (true) WITH CHECK (true);
CREATE POLICY plateforme ON utilisateurs FOR SELECT TO hanout_plateforme USING (true);
-- Le rôle de l'application ne lit jamais les mots de passe ni les secrets, et ne crée pas de compte.
GRANT SELECT (id, commercant_id, nom, telephone, role, langue, totp_actif, desactive, supprime_le, bloque_jusqua, cree_le)
  ON utilisateurs TO hanout_app;
GRANT UPDATE (nom, role, langue, desactive, supprime_le, telephone) ON utilisateurs TO hanout_app;
GRANT SELECT, INSERT, UPDATE ON utilisateurs TO hanout_auth;
GRANT SELECT (id, commercant_id, nom, telephone, role, desactive, supprime_le, cree_le) ON utilisateurs TO hanout_plateforme;

-- ───────────── Administrateurs de la plateforme ─────────────
CREATE TABLE administrateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifiant text NOT NULL UNIQUE,
  mot_de_passe text NOT NULL,
  totp_secret_chiffre text,
  totp_actif boolean NOT NULL DEFAULT false,
  codes_secours text[] NOT NULL DEFAULT '{}',
  echecs integer NOT NULL DEFAULT 0,
  bloque_jusqua timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON administrateurs TO hanout_auth;

-- ───────────── Sessions ─────────────
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeton_hash text NOT NULL UNIQUE,
  utilisateur_id uuid,
  commercant_id uuid REFERENCES commercants (id),
  administrateur_id uuid REFERENCES administrateurs (id) ON DELETE CASCADE,
  mfa_ok boolean NOT NULL DEFAULT false,
  appareil text NOT NULL DEFAULT '',
  cree_le timestamptz NOT NULL DEFAULT now(),
  vue_le timestamptz NOT NULL DEFAULT now(),
  expire_le timestamptz NOT NULL,
  FOREIGN KEY (utilisateur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  CHECK ((utilisateur_id IS NOT NULL AND commercant_id IS NOT NULL AND administrateur_id IS NULL)
      OR (utilisateur_id IS NULL AND commercant_id IS NULL AND administrateur_id IS NOT NULL))
);
CREATE INDEX sessions_utilisateur ON sessions (utilisateur_id);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON sessions TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
CREATE POLICY auth ON sessions TO hanout_auth USING (true) WITH CHECK (true);
GRANT SELECT (id, utilisateur_id, commercant_id, appareil, cree_le, vue_le, expire_le), DELETE ON sessions TO hanout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO hanout_auth;

-- ───────────── Invitations et liens de réinitialisation ─────────────
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeton_hash text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('commercant', 'employe', 'reinitialisation')),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  utilisateur_id uuid,
  nom text,
  telephone text CHECK (telephone IS NULL OR telephone ~ '^0[0-9]{9}$'),
  role text CHECK (role IS NULL OR role IN ('proprietaire', 'vendeur', 'preparateur')),
  expire_le timestamptz NOT NULL,
  utilisee_le timestamptz,
  annulee_le timestamptz,
  cree_par_utilisateur uuid,
  cree_par_admin uuid REFERENCES administrateurs (id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (utilisateur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  CHECK ((type = 'reinitialisation') = (utilisateur_id IS NOT NULL)),
  CHECK (type <> 'employe' OR role IN ('vendeur', 'preparateur'))
);
CREATE INDEX invitations_commercant ON invitations (commercant_id);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
-- Un commerçant ne peut pas créer d'invitation de commerçant : réservé à la plateforme.
CREATE POLICY isolation ON invitations TO hanout_app
  USING (commercant_id = app_commercant())
  WITH CHECK (commercant_id = app_commercant() AND type <> 'commercant');
CREATE POLICY auth ON invitations TO hanout_auth USING (true) WITH CHECK (true);
CREATE POLICY plateforme ON invitations TO hanout_plateforme USING (true) WITH CHECK (true);
GRANT SELECT (id, type, commercant_id, utilisateur_id, nom, telephone, role, expire_le, utilisee_le, annulee_le, cree_le),
      INSERT, UPDATE (annulee_le) ON invitations TO hanout_app;
GRANT SELECT, UPDATE (utilisee_le) ON invitations TO hanout_auth;
GRANT SELECT (id, type, commercant_id, utilisateur_id, nom, telephone, role, expire_le, utilisee_le, annulee_le, cree_le),
      INSERT, UPDATE (annulee_le) ON invitations TO hanout_plateforme;

-- ───────────── Journal des actions sensibles (ajout seulement) ─────────────
CREATE TABLE journal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid REFERENCES commercants (id),
  acteur_type text NOT NULL CHECK (acteur_type IN ('utilisateur', 'administrateur', 'systeme', 'anonyme')),
  acteur_id uuid,
  action text NOT NULL,
  objet_type text,
  objet_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  ip_tronquee text,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_commercant ON journal_actions (commercant_id, cree_le DESC);
ALTER TABLE journal_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON journal_actions TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
CREATE POLICY auth ON journal_actions FOR INSERT TO hanout_auth WITH CHECK (true);
CREATE POLICY plateforme ON journal_actions TO hanout_plateforme USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON journal_actions TO hanout_app, hanout_plateforme;
GRANT INSERT ON journal_actions TO hanout_auth;

-- ───────────── Limites de débit ─────────────
CREATE TABLE limites_debit (
  cle text PRIMARY KEY,
  debut timestamptz NOT NULL DEFAULT now(),
  compteur integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON limites_debit TO hanout_auth;

-- ───────────── Réglages de la plateforme ─────────────
CREATE TABLE reglages_plateforme (
  cle text PRIMARY KEY,
  valeur jsonb NOT NULL,
  modifie_le timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON reglages_plateforme TO hanout_app, hanout_auth;
GRANT SELECT, INSERT, UPDATE ON reglages_plateforme TO hanout_plateforme;
INSERT INTO reglages_plateforme (cle, valeur) VALUES
  ('mdp_min_proprietaire', '15'),
  ('mdp_min_employe', '8'),
  ('mdp_min_administrateur', '15'),
  ('session_jours_utilisateur', '30'),
  ('session_heures_administrateur', '12'),
  ('invitation_jours', '7'),
  ('connexion_echecs_max', '5'),
  ('connexion_blocage_minutes', '15');
