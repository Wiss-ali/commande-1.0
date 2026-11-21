-- Fiche client modifiable à la main : une note libre du commerçant (« client fidèle », « ne répond pas »…).
-- Chiffrée comme le téléphone et les détails : elle peut contenir des données personnelles.
ALTER TABLE clients ADD COLUMN note_chiffre text;
