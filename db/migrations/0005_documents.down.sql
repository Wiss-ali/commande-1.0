DELETE FROM reglages_plateforme WHERE cle IN ('taux_tva', 'timbre');
ALTER TABLE mouvements_stock DROP CONSTRAINT mouvements_stock_document_id_commercant_id_fkey;
DROP TABLE ecarts_stock, liens_documents, lignes_document, documents, compteurs_documents, sessions_caisse, clients;
DROP FUNCTION ligne_document_figee(), document_fige(), caisse_figee();
ALTER TABLE produits DROP COLUMN taux_tva;
ALTER TABLE commercants DROP COLUMN reglages_documents;
