-- Design des boutiques : activité (textes d'exemple), ambiance (polices et formes), logo dessiné par l'application
-- (forme + icône ou initiales) quand aucun logo n'est envoyé, phrase d'accroche. Le commerçant peut supprimer sa
-- boutique : ses réglages disparaissent, son adresse est libérée ; produits, commandes et documents restent.
ALTER TABLE boutiques ADD COLUMN activite text NOT NULL DEFAULT 'autre' CHECK (activite ~ '^[a-z]{3,20}$');
ALTER TABLE boutiques ADD COLUMN ambiance text NOT NULL DEFAULT 'moderne' CHECK (ambiance IN ('moderne', 'elegant', 'chaleureux', 'audacieux'));
ALTER TABLE boutiques ADD COLUMN logo_forme text NOT NULL DEFAULT 'rond' CHECK (logo_forme IN ('rond', 'carre', 'contour', 'texte'));
-- Icône du logo dessiné (clé connue de l'application) ; NULL : les initiales du magasin.
ALTER TABLE boutiques ADD COLUMN logo_icone text CHECK (logo_icone IS NULL OR logo_icone ~ '^[a-z]{2,20}$');
ALTER TABLE boutiques ADD COLUMN slogan_fr text NOT NULL DEFAULT '' CHECK (length(slogan_fr) <= 80);
ALTER TABLE boutiques ADD COLUMN slogan_ar text NOT NULL DEFAULT '' CHECK (length(slogan_ar) <= 80);
GRANT DELETE ON boutiques TO hanout_app;
