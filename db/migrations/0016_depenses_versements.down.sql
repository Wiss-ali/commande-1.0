DROP INDEX commandes_a_reverser;
ALTER TABLE commandes DROP COLUMN versement_id;
DROP TABLE versements_transporteur;
DROP TABLE depenses;
DROP FUNCTION depense_figee();
