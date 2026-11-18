-- Lot d'ajouts 1 : moyens de paiement, paiements en plusieurs fois, vente à crédit, remises, avoir partiel.

-- ───────────── Moyens de paiement ─────────────
-- Résumé sur le document : le moyen utilisé, ou « mixte » s'il y en a plusieurs. Le détail est dans `paiements`.
ALTER TABLE documents DROP CONSTRAINT documents_mode_paiement_check;
ALTER TABLE documents ADD CONSTRAINT documents_mode_paiement_check
  CHECK (mode_paiement IS NULL OR mode_paiement IN ('especes', 'a_la_livraison', 'cheque', 'virement', 'ccp', 'autre', 'mixte'));

-- Chaque somme reçue (ou rendue, montant négatif) pour une facture ou un ticket. Ne se modifie ni ne s'efface.
-- Les espèces sont rattachées à la journée de caisse ouverte : la clôture les compte.
CREATE TABLE paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  document_id uuid NOT NULL,
  montant bigint NOT NULL CHECK (montant <> 0),
  mode text NOT NULL CHECK (mode IN ('especes', 'cheque', 'virement', 'ccp', 'autre', 'a_la_livraison')),
  -- Numéro du chèque, référence du virement… (facultatif).
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 60),
  -- Pièce qui l'accompagne : le reçu (versement) ou l'avoir (argent rendu). Vide pour le paiement d'une vente au comptant.
  piece_id uuid,
  session_caisse_id uuid,
  cree_par uuid NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK ((mode = 'especes') = (session_caisse_id IS NOT NULL)),
  FOREIGN KEY (document_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (piece_id, commercant_id) REFERENCES documents (id, commercant_id),
  FOREIGN KEY (session_caisse_id, commercant_id) REFERENCES sessions_caisse (id, commercant_id),
  FOREIGN KEY (cree_par, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
CREATE INDEX paiements_document ON paiements (document_id);
CREATE INDEX paiements_caisse ON paiements (session_caisse_id) WHERE session_caisse_id IS NOT NULL;
CREATE INDEX paiements_commercant ON paiements (commercant_id, cree_le DESC);

-- ───────────── Remises et avoir partiel ─────────────
-- Remise sur la ligne, en centimes, taxes comprises : total de la ligne = prix × quantité − remise.
ALTER TABLE lignes_document ADD COLUMN remise bigint NOT NULL DEFAULT 0 CHECK (remise >= 0);
-- Ligne d'un avoir : la ligne de la facture ou du ticket qu'elle corrige (retour d'une partie).
ALTER TABLE lignes_document ADD COLUMN ligne_origine_id uuid REFERENCES lignes_document (id);
CREATE INDEX lignes_document_origine ON lignes_document (ligne_origine_id) WHERE ligne_origine_id IS NOT NULL;

-- Droit accordé par le propriétaire à un vendeur : faire des remises.
ALTER TABLE utilisateurs ADD COLUMN peut_remiser boolean NOT NULL DEFAULT false;
GRANT SELECT (peut_remiser), UPDATE (peut_remiser) ON utilisateurs TO hanout_app;

-- ───────────── Reprise des données existantes ─────────────
-- L'isolation forcée s'applique aussi au propriétaire des tables : suspendue le temps de la reprise.
ALTER TABLE documents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE lignes_document NO FORCE ROW LEVEL SECURITY;
ALTER TABLE liens_documents NO FORCE ROW LEVEL SECURITY;
-- Les documents émis sont figés par un déclencheur : il est suspendu le temps de relier les anciennes lignes d'avoir.
ALTER TABLE lignes_document DISABLE TRIGGER lignes_document_figees;
UPDATE lignes_document la SET ligne_origine_id = ls.id
FROM liens_documents l, lignes_document ls
WHERE l.nature = 'corrige_par' AND la.document_id = l.cible_id AND ls.document_id = l.source_id AND ls.ordre = la.ordre;
ALTER TABLE lignes_document ENABLE TRIGGER lignes_document_figees;

-- Vente payée tout de suite en espèces (ou facture payée à la livraison), sans reçu.
INSERT INTO paiements (commercant_id, document_id, montant, mode, session_caisse_id, cree_par, cree_le)
SELECT d.commercant_id, d.id, d.total, d.mode_paiement, CASE WHEN d.mode_paiement = 'especes' THEN d.session_caisse_id END, d.emis_par, d.paye_le
FROM documents d
WHERE d.type IN ('facture', 'ticket') AND d.paye_le IS NOT NULL AND d.mode_paiement IN ('especes', 'a_la_livraison')
  AND (d.mode_paiement <> 'especes' OR d.session_caisse_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM liens_documents l WHERE l.source_id = d.id AND l.nature = 'regle_par');
-- Facture réglée plus tard par un reçu en espèces.
INSERT INTO paiements (commercant_id, document_id, montant, mode, piece_id, session_caisse_id, cree_par, cree_le)
SELECT r.commercant_id, l.source_id, r.total, 'especes', r.id, r.session_caisse_id, r.emis_par, r.emis_le
FROM documents r JOIN liens_documents l ON l.cible_id = r.id AND l.nature = 'regle_par'
WHERE r.type = 'recu' AND r.session_caisse_id IS NOT NULL;
-- Argent rendu en espèces par un avoir.
INSERT INTO paiements (commercant_id, document_id, montant, mode, piece_id, session_caisse_id, cree_par, cree_le)
SELECT a.commercant_id, l.source_id, a.total, 'especes', a.id, a.session_caisse_id, a.emis_par, a.emis_le
FROM documents a JOIN liens_documents l ON l.cible_id = a.id AND l.nature = 'corrige_par'
WHERE a.type = 'avoir' AND a.paye_le IS NOT NULL AND a.mode_paiement = 'especes' AND a.session_caisse_id IS NOT NULL AND a.total <> 0;

ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE lignes_document FORCE ROW LEVEL SECURITY;
ALTER TABLE liens_documents FORCE ROW LEVEL SECURITY;

-- ───────────── Solde de chaque vente ─────────────
-- net : ce qui reste vendu après les avoirs (0 = entièrement annulée) ; paye : reçu moins rendu.
-- Vue « security_invoker » : l'isolation de chaque commerçant s'applique comme sur les tables.
CREATE VIEW soldes_documents WITH (security_invoker = true) AS
SELECT d.id AS document_id, d.commercant_id, d.client_id, d.type, d.mode_vente, d.emis_le, d.total,
  d.total + coalesce((SELECT sum(a.total) FROM liens_documents l JOIN documents a ON a.id = l.cible_id
                      WHERE l.source_id = d.id AND l.nature = 'corrige_par'), 0) AS net,
  coalesce((SELECT sum(p.montant) FROM paiements p WHERE p.document_id = d.id), 0) AS paye
FROM documents d
WHERE d.type IN ('facture', 'ticket');

-- ───────────── Isolation et droits ─────────────
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON paiements TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
GRANT SELECT, INSERT ON paiements TO hanout_app;
GRANT SELECT ON soldes_documents TO hanout_app;
