-- Étape 2 : catégories, produits, variantes, stock, mouvements, photos, inventaires.
-- Règle centrale : le stock ne change que par un mouvement. Le rôle de l'application ne peut pas
-- écrire dans « stocks » ; c'est un déclencheur qui applique chaque mouvement.

-- ───────────── Catégories ─────────────
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom_fr text NOT NULL DEFAULT '' CHECK (length(nom_fr) <= 60),
  nom_ar text NOT NULL DEFAULT '' CHECK (length(nom_ar) <= 60),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (nom_fr <> '' OR nom_ar <> ''),
  UNIQUE (id, commercant_id)
);
CREATE INDEX categories_commercant ON categories (commercant_id);

-- ───────────── Produits ─────────────
CREATE TABLE produits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom_fr text NOT NULL DEFAULT '' CHECK (length(nom_fr) <= 120),
  nom_ar text NOT NULL DEFAULT '' CHECK (length(nom_ar) <= 120),
  categorie_id uuid,
  visible_boutique boolean NOT NULL DEFAULT false,
  archive_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CHECK (nom_fr <> '' OR nom_ar <> ''),
  UNIQUE (id, commercant_id),
  FOREIGN KEY (categorie_id, commercant_id) REFERENCES categories (id, commercant_id) ON DELETE SET NULL (categorie_id)
);
CREATE INDEX produits_commercant ON produits (commercant_id, cree_le DESC);
CREATE TRIGGER produits_modifie BEFORE UPDATE ON produits FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- ───────────── Variantes ─────────────
-- Un produit sans variante a une seule variante au libellé vide : le stock est toujours porté par la variante.
CREATE TABLE variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  produit_id uuid NOT NULL,
  libelle text NOT NULL DEFAULT '' CHECK (length(libelle) <= 60),
  code_barres text CHECK (code_barres ~ '^[\x21-\x7E]{1,64}$'),
  prix_achat bigint NOT NULL DEFAULT 0 CHECK (prix_achat >= 0),
  prix_vente bigint NOT NULL DEFAULT 0 CHECK (prix_vente >= 0),
  prix_barre bigint CHECK (prix_barre IS NULL OR prix_barre >= 0),
  seuil_alerte integer NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
  ordre integer NOT NULL DEFAULT 0,
  archive_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id),
  FOREIGN KEY (produit_id, commercant_id) REFERENCES produits (id, commercant_id)
);
CREATE INDEX variantes_produit ON variantes (produit_id);
-- Un code-barres ne désigne qu'un seul article en vente chez un commerçant.
CREATE UNIQUE INDEX variantes_code_unique ON variantes (commercant_id, code_barres) WHERE code_barres IS NOT NULL AND archive_le IS NULL;
CREATE TRIGGER variantes_modifie BEFORE UPDATE ON variantes FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- ───────────── Stock ─────────────
CREATE TABLE stocks (
  variante_id uuid PRIMARY KEY,
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  quantite integer NOT NULL DEFAULT 0,
  reservee integer NOT NULL DEFAULT 0,
  CONSTRAINT stock_insuffisant CHECK (quantite >= 0),
  CONSTRAINT stock_reserve CHECK (reservee >= 0 AND reservee <= quantite),
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id)
);
CREATE INDEX stocks_commercant ON stocks (commercant_id);

-- ───────────── Inventaires ─────────────
CREATE TABLE inventaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  etat text NOT NULL DEFAULT 'en_cours' CHECK (etat IN ('en_cours', 'valide', 'annule')),
  cree_par uuid NOT NULL,
  termine_par uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  termine_le timestamptz,
  UNIQUE (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  FOREIGN KEY (termine_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
-- Un seul inventaire ouvert à la fois par commerçant.
CREATE UNIQUE INDEX inventaires_un_seul_ouvert ON inventaires (commercant_id) WHERE etat = 'en_cours';
CREATE INDEX inventaires_commercant ON inventaires (commercant_id, cree_le DESC);

CREATE TABLE lignes_inventaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  inventaire_id uuid NOT NULL,
  variante_id uuid NOT NULL,
  quantite_comptee integer NOT NULL CHECK (quantite_comptee >= 0),
  -- Stock connu de l'application au moment de la validation.
  quantite_theorique integer,
  compte_par uuid NOT NULL,
  modifie_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventaire_id, variante_id),
  FOREIGN KEY (inventaire_id, commercant_id) REFERENCES inventaires (id, commercant_id),
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id),
  FOREIGN KEY (compte_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX lignes_inventaire_commercant ON lignes_inventaire (commercant_id);
CREATE TRIGGER lignes_inventaire_modifie BEFORE UPDATE ON lignes_inventaire FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- Un inventaire terminé ne se modifie plus, ni ses lignes.
CREATE FUNCTION inventaire_fige() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.etat <> 'en_cours' THEN RAISE EXCEPTION 'inventaire_termine'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventaires_fige BEFORE UPDATE ON inventaires FOR EACH ROW EXECUTE FUNCTION inventaire_fige();

CREATE FUNCTION ligne_inventaire_figee() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE etat_inv text;
BEGIN
  SELECT etat INTO etat_inv FROM inventaires WHERE id = COALESCE(NEW.inventaire_id, OLD.inventaire_id);
  IF etat_inv IS DISTINCT FROM 'en_cours' THEN RAISE EXCEPTION 'inventaire_termine'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER lignes_inventaire_figees BEFORE INSERT OR UPDATE OR DELETE ON lignes_inventaire FOR EACH ROW EXECUTE FUNCTION ligne_inventaire_figee();

-- ───────────── Mouvements de stock (ajout seulement) ─────────────
-- « quantite » est signée. Entrée, retour : +. Vente : −. Correction : + ou −.
-- Réservation (+) et libération (−) ne changent que la quantité réservée.
CREATE TABLE mouvements_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  variante_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('entree', 'vente', 'retour', 'correction', 'reservation', 'liberation')),
  quantite integer NOT NULL CHECK (quantite <> 0),
  stock_apres integer NOT NULL DEFAULT 0,
  motif text CHECK (motif IS NULL OR motif IN ('stock_initial', 'achat', 'import', 'inventaire', 'casse', 'perte', 'perime', 'erreur', 'autre')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  cout_unitaire bigint CHECK (cout_unitaire IS NULL OR cout_unitaire >= 0),
  auteur_id uuid NOT NULL,
  inventaire_id uuid,
  -- Document à l'origine du mouvement (facture, commande…) : relié à partir de l'étape 3.
  document_id uuid,
  -- Clé d'idempotence : un double toucher ne crée pas deux mouvements.
  cle uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK ((type IN ('entree', 'retour', 'reservation') AND quantite > 0)
      OR (type IN ('vente', 'liberation') AND quantite < 0)
      OR type = 'correction'),
  FOREIGN KEY (variante_id, commercant_id) REFERENCES variantes (id, commercant_id),
  FOREIGN KEY (auteur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id),
  FOREIGN KEY (inventaire_id, commercant_id) REFERENCES inventaires (id, commercant_id)
);
CREATE INDEX mouvements_variante ON mouvements_stock (variante_id, cree_le DESC);
CREATE INDEX mouvements_commercant ON mouvements_stock (commercant_id, cree_le DESC);
CREATE UNIQUE INDEX mouvements_cle ON mouvements_stock (commercant_id, cle) WHERE cle IS NOT NULL;

-- ───────────── Photos ─────────────
-- Le fichier est rangé sur le disque sous <commerçant>/<id>.webp, jamais dans la base.
CREATE TABLE photos_produit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  produit_id uuid NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  cree_le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (produit_id, commercant_id) REFERENCES produits (id, commercant_id)
);
CREATE INDEX photos_produit_produit ON photos_produit (produit_id, ordre);

-- ───────────── Déclencheurs du stock ─────────────
-- Ils s'exécutent avec les droits du propriétaire des tables, mais restent soumis à la RLS :
-- la règle « declencheur » ci-dessous les limite au commerçant de la transaction.
CREATE FUNCTION creer_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO stocks (variante_id, commercant_id) VALUES (NEW.id, NEW.commercant_id);
  RETURN NEW;
END $$;
CREATE TRIGGER variantes_stock AFTER INSERT ON variantes FOR EACH ROW EXECUTE FUNCTION creer_stock();

-- Après l'ajout (et non avant) : un mouvement refusé ou ignoré ne touche jamais le stock.
CREATE FUNCTION appliquer_mouvement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE apres integer;
BEGIN
  IF NEW.type IN ('reservation', 'liberation') THEN
    UPDATE stocks SET reservee = reservee + NEW.quantite
      WHERE variante_id = NEW.variante_id AND commercant_id = NEW.commercant_id RETURNING quantite INTO apres;
  ELSE
    UPDATE stocks SET quantite = quantite + NEW.quantite
      WHERE variante_id = NEW.variante_id AND commercant_id = NEW.commercant_id RETURNING quantite INTO apres;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'stock_introuvable'; END IF;
  UPDATE mouvements_stock SET stock_apres = apres WHERE id = NEW.id;
  RETURN NULL;
END $$;
CREATE TRIGGER mouvements_appliquer AFTER INSERT ON mouvements_stock FOR EACH ROW EXECUTE FUNCTION appliquer_mouvement();

-- ───────────── Isolation et droits ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories', 'produits', 'variantes', 'stocks', 'inventaires', 'lignes_inventaire', 'mouvements_stock', 'photos_produit'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
CREATE POLICY declencheur ON stocks TO CURRENT_USER USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
CREATE POLICY declencheur ON mouvements_stock TO CURRENT_USER USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO hanout_app;
GRANT SELECT, INSERT, UPDATE ON produits, variantes TO hanout_app;
GRANT SELECT ON stocks TO hanout_app;
GRANT SELECT, INSERT ON mouvements_stock TO hanout_app;
GRANT SELECT, INSERT, DELETE ON photos_produit TO hanout_app;
GRANT SELECT, INSERT, UPDATE (etat, termine_par, termine_le) ON inventaires TO hanout_app;
GRANT SELECT, INSERT, UPDATE (quantite_comptee, quantite_theorique, compte_par), DELETE ON lignes_inventaire TO hanout_app;
