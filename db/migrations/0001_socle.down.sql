DROP TABLE reglages_plateforme, limites_debit, journal_actions, invitations, sessions, administrateurs, utilisateurs, commercants;
DROP FUNCTION toucher_modifie_le();
DROP FUNCTION app_commercant();
REVOKE USAGE ON SCHEMA public FROM hanout_app, hanout_auth, hanout_plateforme;
