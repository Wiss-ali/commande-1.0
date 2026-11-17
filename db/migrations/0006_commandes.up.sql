-- Étape 4 : wilayas, communes, transporteurs, frais de livraison, commandes à livrer et leur historique.

-- ───────────── Découpage territorial (données de la plateforme, modifiables par l'administrateur) ─────────────
CREATE TABLE wilayas (
  code integer PRIMARY KEY CHECK (code BETWEEN 1 AND 99),
  nom_fr text NOT NULL CHECK (length(nom_fr) BETWEEN 1 AND 60),
  nom_ar text NOT NULL CHECK (length(nom_ar) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE communes (
  id serial PRIMARY KEY,
  wilaya_code integer NOT NULL REFERENCES wilayas (code),
  nom_fr text NOT NULL CHECK (length(nom_fr) BETWEEN 1 AND 80),
  nom_ar text NOT NULL DEFAULT '' CHECK (length(nom_ar) <= 80),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (wilaya_code, nom_fr)
);
-- Liste officielle : 58 wilayas, plus les 11 créées par la loi modifiant la loi 84-09,
-- numérotées par le décret présidentiel 26-206 du 25/05/2026 (à vérifier au Journal officiel).
INSERT INTO wilayas (code, nom_fr, nom_ar) VALUES
  (1, 'Adrar', 'أدرار'), (2, 'Chlef', 'الشلف'), (3, 'Laghouat', 'الأغواط'), (4, 'Oum El Bouaghi', 'أم البواقي'),
  (5, 'Batna', 'باتنة'), (6, 'Béjaïa', 'بجاية'), (7, 'Biskra', 'بسكرة'), (8, 'Béchar', 'بشار'),
  (9, 'Blida', 'البليدة'), (10, 'Bouira', 'البويرة'), (11, 'Tamanrasset', 'تمنراست'), (12, 'Tébessa', 'تبسة'),
  (13, 'Tlemcen', 'تلمسان'), (14, 'Tiaret', 'تيارت'), (15, 'Tizi Ouzou', 'تيزي وزو'), (16, 'Alger', 'الجزائر'),
  (17, 'Djelfa', 'الجلفة'), (18, 'Jijel', 'جيجل'), (19, 'Sétif', 'سطيف'), (20, 'Saïda', 'سعيدة'),
  (21, 'Skikda', 'سكيكدة'), (22, 'Sidi Bel Abbès', 'سيدي بلعباس'), (23, 'Annaba', 'عنابة'), (24, 'Guelma', 'قالمة'),
  (25, 'Constantine', 'قسنطينة'), (26, 'Médéa', 'المدية'), (27, 'Mostaganem', 'مستغانم'), (28, 'M''Sila', 'المسيلة'),
  (29, 'Mascara', 'معسكر'), (30, 'Ouargla', 'ورقلة'), (31, 'Oran', 'وهران'), (32, 'El Bayadh', 'البيض'),
  (33, 'Illizi', 'إليزي'), (34, 'Bordj Bou Arréridj', 'برج بوعريريج'), (35, 'Boumerdès', 'بومرداس'), (36, 'El Tarf', 'الطارف'),
  (37, 'Tindouf', 'تندوف'), (38, 'Tissemsilt', 'تيسمسيلت'), (39, 'El Oued', 'الوادي'), (40, 'Khenchela', 'خنشلة'),
  (41, 'Souk Ahras', 'سوق أهراس'), (42, 'Tipaza', 'تيبازة'), (43, 'Mila', 'ميلة'), (44, 'Aïn Defla', 'عين الدفلى'),
  (45, 'Naâma', 'النعامة'), (46, 'Aïn Témouchent', 'عين تموشنت'), (47, 'Ghardaïa', 'غرداية'), (48, 'Relizane', 'غليزان'),
  (49, 'Timimoun', 'تيميمون'), (50, 'Bordj Badji Mokhtar', 'برج باجي مختار'), (51, 'Ouled Djellal', 'أولاد جلال'), (52, 'Béni Abbès', 'بني عباس'),
  (53, 'In Salah', 'عين صالح'), (54, 'In Guezzam', 'عين قزام'), (55, 'Touggourt', 'تقرت'), (56, 'Djanet', 'جانت'),
  (57, 'El M''Ghair', 'المغير'), (58, 'El Meniaa', 'المنيعة'),
  (59, 'Aflou', 'أفلو'), (60, 'Barika', 'بريكة'), (61, 'El Kantara', 'القنطرة'), (62, 'Bir El Ater', 'بئر العاتر'),
  (63, 'El Aricha', 'العريشة'), (64, 'Ksar Chellala', 'قصر الشلالة'), (65, 'Aïn Oussera', 'عين وسارة'), (66, 'Messaad', 'مسعد'),
  (67, 'Ksar El Boukhari', 'قصر البخاري'), (68, 'Bou Saâda', 'بوسعادة'), (69, 'El Abiodh Sidi Cheikh', 'الأبيض سيدي الشيخ');

-- Lecture pour tous les commerçants, écriture par l'administration seulement.
ALTER TABLE wilayas ENABLE ROW LEVEL SECURITY;
ALTER TABLE wilayas FORCE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes FORCE ROW LEVEL SECURITY;
CREATE POLICY lecture ON wilayas FOR SELECT TO hanout_app, hanout_auth USING (true);
CREATE POLICY lecture ON communes FOR SELECT TO hanout_app, hanout_auth USING (true);
CREATE POLICY plateforme ON wilayas TO hanout_plateforme USING (true) WITH CHECK (true);
CREATE POLICY plateforme ON communes TO hanout_plateforme USING (true) WITH CHECK (true);
GRANT SELECT ON wilayas, communes TO hanout_app, hanout_auth;
GRANT SELECT, INSERT, UPDATE ON wilayas, communes TO hanout_plateforme;
GRANT USAGE ON SEQUENCE communes_id_seq TO hanout_plateforme;


-- ───────────── Transporteurs et frais de livraison du commerçant ─────────────
CREATE TABLE transporteurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  nom text NOT NULL CHECK (length(nom) BETWEEN 1 AND 60),
  actif boolean NOT NULL DEFAULT true,
  -- Nom du connecteur d'API (vide : saisie à la main). Les identifiants d'API ne sont jamais stockés ici.
  connecteur text CHECK (connecteur IS NULL OR length(connecteur) <= 40),
  cree_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id),
  UNIQUE (commercant_id, nom)
);

-- Prix payé par le client pour la livraison dans une wilaya. NULL : ce mode n'est pas proposé.
CREATE TABLE frais_livraison (
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  wilaya_code integer NOT NULL REFERENCES wilayas (code),
  domicile bigint CHECK (domicile IS NULL OR domicile BETWEEN 0 AND 10000000),
  point_relais bigint CHECK (point_relais IS NULL OR point_relais BETWEEN 0 AND 10000000),
  PRIMARY KEY (commercant_id, wilaya_code)
);

-- ───────────── Commandes à livrer ─────────────
-- Les articles d'une commande sont les lignes de son devis (une information à un seul endroit).
-- Le colis fait partie de la commande : transporteur, numéro de suivi, dates d'expédition, de livraison, de retour.
CREATE TABLE commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  annee integer NOT NULL,
  numero integer NOT NULL CHECK (numero > 0),
  statut text NOT NULL CHECK (statut IN ('nouvelle', 'a_confirmer', 'confirmee', 'preparee', 'expediee', 'livree', 'retournee', 'annulee')),
  origine text NOT NULL CHECK (origine IN ('manuel', 'boutique')),
  devis_id uuid NOT NULL,
  facture_id uuid,
  avoir_id uuid,
  client_id uuid NOT NULL,
  tentatives_appel integer NOT NULL DEFAULT 0 CHECK (tentatives_appel >= 0),
  dernier_appel_le timestamptz,
  livraison text NOT NULL CHECK (livraison IN ('domicile', 'point_relais')),
  wilaya_code integer NOT NULL REFERENCES wilayas (code),
  commune text NOT NULL CHECK (length(commune) BETWEEN 1 AND 80),
  -- Adresse ou point relais choisi (chiffrée).
  adresse_chiffre text,
  frais_livraison bigint NOT NULL DEFAULT 0 CHECK (frais_livraison >= 0),
  transporteur_id uuid,
  numero_suivi text CHECK (numero_suivi IS NULL OR length(numero_suivi) <= 60),
  expediee_le timestamptz,
  livree_le timestamptz,
  retournee_le timestamptz,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  cle uuid,
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, commercant_id),
  UNIQUE (commercant_id, annee, numero),
  FOREIGN KEY (devis_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (facture_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (avoir_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (client_id, commercant_id) REFERENCES clients (id, commercant_id),
  FOREIGN KEY (transporteur_id, commercant_id) REFERENCES transporteurs (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX commandes_liste ON commandes (commercant_id, statut, cree_le DESC);
CREATE INDEX commandes_client ON commandes (client_id);
CREATE UNIQUE INDEX commandes_devis ON commandes (devis_id);
CREATE UNIQUE INDEX commandes_cle ON commandes (commercant_id, cle) WHERE cle IS NOT NULL;
CREATE TRIGGER commandes_modifie BEFORE UPDATE ON commandes FOR EACH ROW EXECUTE FUNCTION toucher_modifie_le();

-- Historique : chaque changement de statut et chaque appel, avec son auteur. En ajout seulement.
CREATE TABLE historique_commande (
  id bigserial PRIMARY KEY,
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  commande_id uuid NOT NULL,
  evenement text NOT NULL CHECK (evenement IN ('creee', 'appel_sans_reponse', 'statut', 'modifiee')),
  ancien_statut text,
  nouveau_statut text,
  auteur uuid NOT NULL,
  le timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commande_id, commercant_id) REFERENCES commandes (id, commercant_id),
  FOREIGN KEY (auteur, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX historique_commande_commande ON historique_commande (commande_id, le);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transporteurs', 'frais_livraison', 'commandes', 'historique_commande'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY isolation ON %I TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant())', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE (nom, actif, connecteur) ON transporteurs TO hanout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON frais_livraison TO hanout_app;
-- Une commande ne se supprime pas : elle s'annule.
GRANT SELECT, INSERT, UPDATE ON commandes TO hanout_app;
GRANT SELECT, INSERT ON historique_commande TO hanout_app;
GRANT USAGE ON SEQUENCE historique_commande_id_seq TO hanout_app;
