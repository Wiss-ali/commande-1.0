-- Mesure des publicités de la boutique (pixel Facebook / Instagram, pixel TikTok). Vide par défaut :
-- rien n'est chargé tant que le commerçant n'a pas collé son identifiant. Le format est vérifié par la base,
-- pour qu'aucun texte libre ne puisse être glissé dans la page.
ALTER TABLE boutiques ADD COLUMN pixel_facebook text CHECK (pixel_facebook IS NULL OR pixel_facebook ~ '^[0-9]{8,20}$');
ALTER TABLE boutiques ADD COLUMN pixel_tiktok text CHECK (pixel_tiktok IS NULL OR pixel_tiktok ~ '^[A-Z0-9]{10,30}$');
