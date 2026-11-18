-- Boutique de démonstration de l'administrateur : un commerçant fictif, ouvert d'un bouton dans l'administration.
-- Il n'est jamais compté parmi les commerçants, les abonnements ou le revenu. Une seule démo active à la fois ;
-- « Remettre à zéro » archive l'ancienne et en crée une neuve.
ALTER TABLE commercants ADD COLUMN demo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX commercants_demo_active ON commercants (demo) WHERE demo AND etat <> 'archive';
