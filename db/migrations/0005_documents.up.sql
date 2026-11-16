-- Étape 3 : clients, documents commerciaux, numérotation, caisse.

-- Réglages de facturation du commerçant (TVA, timbre, mentions) et taux de TVA par produit.
ALTER TABLE commercants ADD COLUMN reglages_documents jsonb NOT NULL DEFAULT '{}';
GRANT UPDATE (reglages_documents) ON commercants TO hanout_app;
-- Taux en centièmes de pour cent (1900 = 19 %). NULL : le taux par défaut du commerçant.
ALTER TABLE produits ADD COLUMN taux_tva integer CHECK (taux_tva IS NULL OR taux_tva BETWEEN 0 AND 10000);

-- ───────────── Clients ─────────────
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 120),
  telephone_chiffre text,
  -- Empreinte du téléphone : retrouver un client sans stocker son numéro en clair.
  telephone_hmac text,
  -- Adresse et numéros légaux de l'acheteur professionnel (JSON chiffré).
  details_chiffre text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id)
);
CREATE UNIQUE INDEX clients_telephone ON clients (commercant_id, telephone_hmac) WHERE telephone_hmac IS NOT NULL;
CREATE INDEX clients_commercant ON clients (commercant_id, cree_le DESC);
CREATE TRIGGER clients_modifie BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- ───────────── Journées de caisse ─────────────
CREATE TABLE sessions_caisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  ouverte_par uuid NOT NULL,
  ouverte_le timestamptz NOT NULL DEFAULT now(),
  fond_ouverture bigint NOT NULL DEFAULT 0 CHECK (fond_ouverture >= 0),
  fermee_par uuid,
  fermee_le timestamptz,
  especes_attendues bigint,
  especes_comptees bigint CHECK (especes_comptees IS NULL OR especes_comptees >= 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  UNIQUE (id, commercant_id),
  FOREIGN KEY (ouverte_par, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  FOREIGN KEY (fermee_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
-- Une seule caisse ouverte à la fois par commerçant.
CREATE UNIQUE INDEX sessions_caisse_ouverte ON sessions_caisse (commercant_id) WHERE fermee_le IS NULL;
CREATE INDEX sessions_caisse_commercant ON sessions_caisse (commercant_id, ouverte_le DESC);
-- Une clôture ne se modifie plus.
CREATE FUNCTION caisse_figee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.fermee_le IS NOT NULL THEN RAISE EXCEPTION 'caisse_cloturee'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sessions_caisse_figee BEFORE UPDATE ON sessions_caisse FOR EACH ROW EXECUTE FUNCTION caisse_figee();

-- ───────────── Numérotation ─────────────
-- Un compteur par commerçant, type et année, verrouillé dans la transaction qui émet le document :
-- si le document échoue, le numéro n'est pas consommé. Aucun trou possible.
CREATE TABLE compteurs_documents (
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  type text NOT NULL,
  annee integer NOT NULL,
  dernier integer NOT NULL DEFAULT 0 CHECK (dernier >= 0),
  PRIMARY KEY (commercant_id, type, annee)
);

-- ───────────── Documents ─────────────
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  type text NOT NULL CHECK (type IN ('devis', 'proforma', 'bon_commande', 'bon_livraison', 'facture', 'avoir', 'recu', 'ticket')),
  annee integer NOT NULL,
  numero integer NOT NULL CHECK (numero > 0),
  etat text NOT NULL DEFAULT 'emis' CHECK (etat IN ('emis', 'en_attente', 'transforme', 'refuse', 'expire')),
  origine text NOT NULL CHECK (origine IN ('caisse', 'manuel', 'boutique')),
  -- Vente directe (stock sorti, payé tout de suite) ou envoi (stock réservé, payé à la livraison).
  mode_vente text CHECK (mode_vente IS NULL OR mode_vente IN ('directe', 'envoi')),
  client_id uuid,
  -- Mentions du vendeur et de l'acheteur, copiées au moment de l'émission (JSON chiffré).
  vendeur_chiffre text NOT NULL,
  acheteur_chiffre text,
  total_ht bigint NOT NULL,
  total_tva bigint NOT NULL,
  timbre bigint NOT NULL DEFAULT 0 CHECK (timbre >= 0),
  -- Total à payer : TTC + timbre. Négatif pour un avoir.
  total bigint NOT NULL,
  mode_paiement text CHECK (mode_paiement IS NULL OR mode_paiement IN ('especes', 'a_la_livraison')),
  paye_le timestamptz,
  valide_jusqua date,
  -- Vrai quand ce document a sorti (ou remis) le stock : le document suivant de la chaîne ne le refait pas.
  stock_sorti boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  session_caisse_id uuid,
  emis_par uuid NOT NULL,
  emis_le timestamptz NOT NULL DEFAULT now(),
  -- Clé d'idempotence : un double toucher ou un renvoi après coupure ne crée pas deux documents.
  cle uuid,
  -- Transaction qui a créé le document : ses lignes ne peuvent être ajoutées que dans cette même transaction.
  transaction_creation bigint NOT NULL DEFAULT txid_current(),
  UNIQUE (id, commercant_id),
  UNIQUE (commercant_id, type, annee, numero),
  CHECK ((type = 'devis') = (etat <> 'emis')),
  FOREIGN KEY (client_id, commercant_id) REFERENCES clients (id, commercant_id),
  FOREIGN KEY (emis_par, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  FOREIGN KEY (session_caisse_id, commercant_id) REFERENCES sessions_caisse (id, commercant_id)
);
CREATE INDEX documents_liste ON documents (commercant_id, type, emis_le DESC);
CREATE INDEX documents_caisse ON documents (session_caisse_id) WHERE session_caisse_id IS NOT NULL;
CREATE UNIQUE INDEX documents_cle ON documents (commercant_id, cle) WHERE cle IS NOT NULL;

CREATE TABLE lignes_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  document_id uuid NOT NULL,
  variante_id uuid,
  designation text NOT NULL CHECK (length(designation) BETWEEN 1 AND 200),
  quantite integer NOT NULL CHECK (quantite > 0),
  -- Prix payé par le client pour une unité, taxes comprises.
  prix_unitaire bigint NOT NULL CHECK (prix_unitaire >= 0),
  taux_tva integer NOT NULL DEFAULT 0 CHECK (taux_tva BETWEEN 0 AND 10000),
  total_ht bigint NOT NULL,
  total_ttc bigint NOT NULL,
  -- Prix d'achat au moment de la vente, pour la marge réelle (étape 5).
  cout_unitaire bigint NOT NULL DEFAULT 0,
  ordre integer NOT NULL DEFAULT 0,
  FOREIGN KEY (document_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id)
);
CREATE INDEX lignes_document_document ON lignes_document (document_id, ordre);

-- Lien entre un document et celui qu'il a créé : transformé en, corrigé par, réglé par.
CREATE TABLE liens_documents (
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  source_id uuid NOT NULL,
  cible_id uuid NOT NULL,
  nature text NOT NULL CHECK (nature IN ('transforme_en', 'corrige_par', 'regle_par')),
  PRIMARY KEY (source_id, cible_id),
  FOREIGN KEY (source_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (cible_id, commercant_id) REFERENCES documents (id, commercant_id)
);
CREATE INDEX liens_documents_cible ON liens_documents (cible_id);

-- Un document émis ne se modifie plus. Seuls changent : l'état d'un devis, et la date de paiement
-- d'une facture (une seule fois). Un devis en attente reste modifiable.
CREATE FUNCTION document_fige() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.type = 'devis' AND OLD.etat = 'en_attente' THEN
    IF NEW.type <> 'devis' OR NEW.numero <> OLD.numero OR NEW.annee <> OLD.annee THEN RAISE EXCEPTION 'document_fige'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.paye_le IS NOT NULL AND NEW.paye_le IS DISTINCT FROM OLD.paye_le THEN RAISE EXCEPTION 'document_fige'; END IF;
  IF (to_jsonb(NEW) - 'paye_le' - 'mode_paiement' - 'etat') <> (to_jsonb(OLD) - 'paye_le' - 'mode_paiement' - 'etat') THEN RAISE EXCEPTION 'document_fige'; END IF;
  IF NEW.etat <> OLD.etat AND OLD.type <> 'devis' THEN RAISE EXCEPTION 'document_fige'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documents_figes BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION document_fige();

CREATE FUNCTION ligne_document_figee() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record;
BEGIN
  SELECT type, etat, transaction_creation INTO d FROM documents WHERE id = COALESCE(NEW.document_id, OLD.document_id);
  -- À l'ajout, les lignes d'un document tout juste créé sont acceptées (même transaction).
  IF TG_OP = 'INSERT' AND d.transaction_creation = txid_current() THEN RETURN NEW; END IF;
  IF d.type IS DISTINCT FROM 'devis' OR d.etat IS DISTINCT FROM 'en_attente' THEN RAISE EXCEPTION 'document_fige'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER lignes_document_figees BEFORE INSERT OR UPDATE OR DELETE ON lignes_document FOR EACH ROW EXECUTE FUNCTION ligne_document_figee();

-- Mouvements de stock : lien vers le document d'origine.
ALTER TABLE mouvements_stock ADD FOREIGN KEY (document_id, commercant_id) REFERENCES documents (id, commercant_id);

-- Vente passée alors que le stock connu ne suffisait pas : à vérifier par le propriétaire.
CREATE TABLE ecarts_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  variante_id uuid NOT NULL,
  document_id uuid NOT NULL,
  quantite integer NOT NULL CHECK (quantite > 0),
  cree_le timestamptz NOT NULL DEFAULT now(),
  traite_le timestamptz,
  traite_par uuid,
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id),
  FOREIGN KEY (document_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (traite_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX ecarts_stock_ouverts ON ecarts_stock (commercant_id) WHERE traite_le IS NULL;

-- ───────────── Isolation et droits ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'sessions_caisse', 'compteurs_documents', 'documents', 'lignes_document', 'liens_documents', 'ecarts_stock'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE ON clients, compteurs_documents TO hanout_app;
GRANT SELECT, INSERT, UPDATE (fond_ouverture, fermee_par, fermee_le, especes_attendues, especes_comptees, note) ON sessions_caisse TO hanout_app;
-- Aucune suppression de document. Les contrôles ci-dessus limitent les modifications.
GRANT SELECT, INSERT, UPDATE ON documents TO hanout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON lignes_document TO hanout_app;
GRANT SELECT, INSERT ON liens_documents TO hanout_app;
GRANT SELECT, INSERT, UPDATE (traite_le, traite_par) ON ecarts_stock TO hanout_app;

-- Réglages fiscaux communs, saisis par l'administrateur. Vides au départ : aucune règle n'est supposée.
INSERT INTO reglages_plateforme (cle, valeur) VALUES
  ('taux_tva', '[]'),
  ('timbre', '{"tranches": []}');
