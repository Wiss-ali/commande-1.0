-- Code de double authentification à usage unique : on garde la tranche de 30 secondes du dernier code accepté,
-- un code déjà utilisé (ou plus ancien) est refusé.
ALTER TABLE utilisateurs ADD COLUMN totp_dernier_pas integer;
ALTER TABLE administrateurs ADD COLUMN totp_dernier_pas integer;
