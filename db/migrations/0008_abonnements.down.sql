DELETE FROM reglages_plateforme WHERE cle IN ('delai_grace_jours', 'lecture_seule_jours', 'rappel_jours_1', 'rappel_jours_2');
REVOKE UPDATE (nom_fr, nom_ar, active) ON wilayas FROM hanout_plateforme;
DROP TABLE abonnements, paiements_abonnement, formules;
DROP FUNCTION ligne_figee();
ALTER TABLE commercants DROP COLUMN modules_ajoutes, DROP COLUMN modules_retires;
