-- Décision du propriétaire (17/11/2026) : 8 caractères suffisent pour le mot de passe d'un commerçant.
-- La liste des mots de passe trop courants et le blocage après plusieurs échecs restent en place.
UPDATE reglages_plateforme SET valeur = '8', modifie_le = now() WHERE cle = 'mdp_min_proprietaire';
