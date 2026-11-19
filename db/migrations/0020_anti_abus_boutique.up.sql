-- Boutique : protection contre les faux tickets qui bloquent le stock (audit du 18/11/2026).
--  - max_par_article : pièces d'un même article dans un ticket (5 par défaut) ;
--  - max_tickets_attente : tickets pas encore confirmés en même temps ; au-delà, la boutique demande d'appeler
--    le vendeur au lieu de réserver encore du stock (20 par défaut).
-- Réglables par le commerçant (écran Boutique › Stock et réservation).
ALTER TABLE boutiques ADD COLUMN max_par_article integer NOT NULL DEFAULT 5 CHECK (max_par_article BETWEEN 1 AND 99);
ALTER TABLE boutiques ADD COLUMN max_tickets_attente integer NOT NULL DEFAULT 20 CHECK (max_tickets_attente BETWEEN 1 AND 500);
