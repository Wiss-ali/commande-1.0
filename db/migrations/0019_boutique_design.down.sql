REVOKE DELETE ON boutiques FROM hanout_app;
ALTER TABLE boutiques DROP COLUMN slogan_ar, DROP COLUMN slogan_fr, DROP COLUMN logo_icone, DROP COLUMN logo_forme, DROP COLUMN ambiance, DROP COLUMN activite;
