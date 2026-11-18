DROP VIEW soldes_documents;
DROP TABLE paiements;
ALTER TABLE utilisateurs DROP COLUMN peut_remiser;
DROP INDEX lignes_document_origine;
ALTER TABLE lignes_document DROP COLUMN ligne_origine_id;
ALTER TABLE lignes_document DROP COLUMN remise;
-- Les documents payés autrement qu'en espèces ou à la livraison gardent une trace dans le journal : on les remet sans moyen.
ALTER TABLE documents NO FORCE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE TRIGGER documents_figes;
UPDATE documents SET mode_paiement = NULL WHERE mode_paiement NOT IN ('especes', 'a_la_livraison');
ALTER TABLE documents ENABLE TRIGGER documents_figes;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE documents DROP CONSTRAINT documents_mode_paiement_check;
ALTER TABLE documents ADD CONSTRAINT documents_mode_paiement_check CHECK (mode_paiement IS NULL OR mode_paiement IN ('especes', 'a_la_livraison'));
