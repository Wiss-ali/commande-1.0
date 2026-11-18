-- Lot d'ajouts 1 : plusieurs photos par produit (ordre modifiable) et barre du bas choisie par chaque personne.
GRANT UPDATE (ordre) ON photos_produit TO hanout_app;
-- Les 4 entrées de la barre du bas (avant « Plus »), dans l'ordre. NULL : celles par défaut.
ALTER TABLE utilisateurs ADD COLUMN barre_bas text[] CHECK (barre_bas IS NULL OR cardinality(barre_bas) BETWEEN 1 AND 4);
GRANT SELECT (barre_bas), UPDATE (barre_bas) ON utilisateurs TO hanout_app;
