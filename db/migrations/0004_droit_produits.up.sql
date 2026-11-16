-- Droit accordé (ou non) par le propriétaire à un vendeur : ajouter et modifier les produits.
-- Choisi à l'invitation, modifiable ensuite dans l'équipe. Sans effet pour un préparateur.
ALTER TABLE utilisateurs ADD COLUMN gere_produits boolean NOT NULL DEFAULT false;
ALTER TABLE invitations ADD COLUMN gere_produits boolean NOT NULL DEFAULT false;
GRANT SELECT (gere_produits), UPDATE (gere_produits) ON utilisateurs TO hanout_app;
GRANT SELECT (gere_produits) ON invitations TO hanout_app;
